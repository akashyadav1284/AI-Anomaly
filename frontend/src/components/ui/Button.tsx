import * as React from "react";
import { cn } from "../../utils/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

    const variantStyles = {
      default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-subtle",
      secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200/80",
      outline: "border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 shadow-subtle",
      ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      destructive: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
    };

    const sizeStyles = {
      default: "h-9 px-4 py-2 text-xs",
      sm: "h-7.5 px-3 py-1 text-xs",
      lg: "h-10 px-5 text-sm",
      icon: "h-8 w-8 p-0",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
