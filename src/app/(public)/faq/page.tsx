import { HelpCircle } from "lucide-react";

export default function FAQPage() {
  const faqs = [
    {
      question: "What is CreatorOS AI?",
      answer: "CreatorOS AI is an all-in-one platform designed for digital creators. It provides tools for lesson generation, voiceovers, avatars, thumbnails, and automated YouTube video generation, making content creation faster and easier."
    },
    {
      question: "How does the AI Lesson Generator work?",
      answer: "Our AI Lesson Generator takes your topic or prompt and automatically structures a comprehensive lesson plan, complete with talking points, examples, and summaries tailored to your audience."
    },
    {
      question: "Can I use my own voice for the Voice Studio?",
      answer: "Yes! Our Voice Studio allows you to either select from our premium library of AI voices or clone your own voice to create personalized and consistent audio for your videos."
    },
    {
      question: "Are the generated thumbnails copyright-free?",
      answer: "Absolutely. All images and assets generated through our Thumbnail Generator are fully licensed for your commercial use and copyright-free."
    },
    {
      question: "Do you offer a free trial?",
      answer: "Yes, we offer a 14-day free trial on our premium plans so you can test out all the features, including the Avatar Studio and YouTube Generator, before committing."
    },
    {
      question: "Can I cancel my subscription at any time?",
      answer: "Yes, you can cancel or pause your subscription at any time from your account settings. There are no hidden fees or cancellation penalties."
    },
    {
      question: "How do I contact support?",
      answer: "You can reach our support team 24/7 by emailing support@creatoros.ai or by using the live chat widget available in your dashboard."
    }
  ];

  return (
    <div className="container py-24 md:py-32">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Frequently Asked Questions</h1>
          <p className="text-muted-foreground text-lg">Have a question? We're here to help.</p>
        </div>
        
        <div className="mt-12 space-y-6">
          {faqs.map((faq, index) => (
            <div key={index} className="p-6 bg-card rounded-2xl border shadow-sm">
              <h3 className="text-lg font-semibold flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                {faq.question}
              </h3>
              <p className="mt-3 text-muted-foreground leading-relaxed ml-8">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
