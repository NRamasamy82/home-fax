import * as React from "react";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-lg border bg-white text-gray-900 shadow-sm ${className ?? ""}`} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 ${className ?? ""}`} {...props} />;
}