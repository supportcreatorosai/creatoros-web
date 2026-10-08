'use client';

import { useFormStatus } from 'react-dom';
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from 'lucide-react';
import React from 'react';

interface SubmitButtonProps {
  label?: string;
  icon?: React.ReactNode;
}

export function SubmitButton({ label = "Save", icon = <Save className="mr-2 h-4 w-4" /> }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : icon}
      {pending ? 'Saving...' : label}
    </Button>
  );
}
