import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex touch-manipulation select-none items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:shadow-blue-600/40",
        destructive:
          "bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600",
        outline:
          "border border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white",
        secondary:
          "bg-slate-800 text-slate-100 hover:bg-slate-700",
        ghost: "hover:bg-slate-800/50 hover:text-slate-100 text-slate-300",
        link: "text-blue-500 underline-offset-4 hover:underline",
        glass: "glass text-white hover:bg-white/10",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, loadingText, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const buttonType = asChild ? undefined : (props.type ?? "button");
    const isDisabled = disabled || isLoading;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={buttonType}
        disabled={isDisabled}
        {...props}
      >
        {isLoading && !asChild ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingText ?? children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
