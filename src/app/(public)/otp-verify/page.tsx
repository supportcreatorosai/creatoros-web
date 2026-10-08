"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import emailjs from "@emailjs/browser";
import { createClient } from "@/lib/supabase/client";
import { verifyOTP } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react";

export default function OTPVerifyPage() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(true);
  const [emailSent, setEmailSent] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    const initAndSendEmail = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push("/login");
          return;
        }

        setUserEmail(user.email ?? null);

        // If already verified, go to dashboard
        if (user.user_metadata?.otp_verified) {
          router.push("/dashboard");
          return;
        }

        // Send EmailJS Email
        const expectedOtp = user.user_metadata?.otp;
        if (expectedOtp && !emailSent) {
          const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "YOUR_SERVICE_ID";
          const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "YOUR_TEMPLATE_ID";
          const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "YOUR_PUBLIC_KEY";

          if (!serviceId || serviceId === "YOUR_SERVICE_ID") {
            // Simulate sending for dev purposes if keys are missing
            setTimeout(() => {
              setIsSendingEmail(false);
              setEmailSent(true);
            }, 1000);
          } else {
            await emailjs.send(serviceId, templateId, {
              to_email: user.email,
              otp_code: expectedOtp,
            }, publicKey);
            setIsSendingEmail(false);
            setEmailSent(true);
          }
        }
      } catch (err) {
        console.error("Failed to send email:", err);
        setError("Failed to send verification email. Please contact support.");
        setIsSendingEmail(false);
      }
    };

    initAndSendEmail();
  }, [router, emailSent]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^[0-9]*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Focus next input
    if (value !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && otp[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6).split("");
    
    if (pastedData.some(char => !/^[0-9]$/.test(char))) return;

    const newOtp = [...otp];
    pastedData.forEach((char, index) => {
      if (index < 6) newOtp[index] = char;
    });
    setOtp(newOtp);
    
    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submittedOtp = otp.join("");
    if (submittedOtp.length < 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await verifyOTP(submittedOtp);
    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6 bg-gradient-to-br from-background to-muted/20">
      <div className="w-full max-w-[420px] p-8 rounded-2xl border border-border bg-card shadow-xl space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Verify your email</h2>
          <p className="text-muted-foreground text-sm">
            We've sent a 6-digit code to <br/>
            <span className="font-medium text-foreground">{userEmail || "your email"}</span>
          </p>
        </div>

        {isSendingEmail ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4 text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin text-primary/50" />
            <p className="text-sm">Sending verification code...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-between gap-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={el => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="w-12 h-14 text-center text-xl font-bold rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  maxLength={1}
                />
              ))}
            </div>

            {error && (
              <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-center">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-12 text-sm font-medium" disabled={isLoading || otp.join("").length < 6}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="animate-spin h-4 w-4" />
                  Verifying...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Verify Account <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>
        )}

        <div className="text-center pt-2">
          <p className="text-sm text-muted-foreground">
            Didn't receive the code?{" "}
            <button 
              type="button"
              className="text-primary font-medium hover:underline focus:outline-none"
              onClick={() => window.location.reload()}
            >
              Resend
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
