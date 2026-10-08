"use client";

import { SelectHTMLAttributes } from "react";

export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      onChange={(e) => {
        if (props.onChange) props.onChange(e);
        e.target.form?.submit();
      }}
    />
  );
}
