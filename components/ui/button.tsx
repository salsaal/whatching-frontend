import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-semibold font-heading transition-all duration-200 outline-none disabled:pointer-events-none disabled:opacity-60 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] shadow-sm",
        outline:
          "border border-border bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 active:scale-[0.98]",
        ghost: "hover:bg-accent hover:text-accent-foreground"
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-3 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  isLoading = false,
  children,
  tooltip,
  spacebetween,
  center,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    isLoading?: boolean;
    spacebetween?: boolean;
    center?: boolean;
    tooltip?: React.ReactNode;
  }) {
  const Comp = asChild ? Slot : "button";

  const button = (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={isLoading || props.disabled}
      {...props}
    >
      <span
        className={cn(
          "inline-flex items-center gap-2",
          spacebetween && "w-full justify-between",
          center && "justify-center"
        )}
      >
        {isLoading && (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {!isLoading && children}
      </span>
    </Comp>
  );

  if (!tooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent sideOffset={6}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export { Button, buttonVariants };
