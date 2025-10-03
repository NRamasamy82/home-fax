import * as React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
}

export function Button({ className, size="md", ...props }: ButtonProps) {
  const sizes = { sm: "px-2 py-1 text-sm", md: "px-3 py-2 text-base", lg: "px-4 py-3 text-lg" };
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 ${sizes[size]} ${className ?? ""}`}
      {...props}
    />
  );
}