import { Slot } from "@radix-ui/react-slot";
import { useButton } from "@react-aria/button";
import { usePress } from "@react-aria/interactions";
import { mergeProps } from "@react-aria/utils";
import type { PressEvent } from "@react-types/shared";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type PressButtonProps = Omit<React.ComponentPropsWithoutRef<"button">, "onClick"> & {
  onPress?: (event: PressEvent) => void;
};

const PressButton = React.forwardRef<HTMLButtonElement, PressButtonProps>(
  ({ onPress, type = "button", disabled, ...props }, forwardedRef) => {
    const ref = React.useRef<HTMLButtonElement>(null);
    React.useImperativeHandle(forwardedRef, () => ref.current!);
    const { buttonProps } = useButton({ isDisabled: disabled, type, onPress }, ref);
    const mergedProps = mergeProps(props, buttonProps);

    return <button {...mergedProps} disabled={disabled} ref={ref} />;
  },
);

PressButton.displayName = "PressButton";

type PressTargetProps = Omit<React.ComponentPropsWithoutRef<"div">, "onClick"> & {
  onPress?: (event: PressEvent) => void;
};

const PressTarget = React.forwardRef<HTMLDivElement, PressTargetProps>(
  ({ onPress, ...props }, forwardedRef) => {
    const ref = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(forwardedRef, () => ref.current!);
    const { pressProps } = usePress({ onPress });
    const mergedProps = mergeProps(props, pressProps);

    return <div {...mergedProps} ref={ref} />;
  },
);

PressTarget.displayName = "PressTarget";

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: PressButtonProps &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const classNames = cn(buttonVariants({ variant, size, className }));

  if (asChild) {
    return <Slot data-slot="button" className={classNames} {...props} />;
  }

  return <PressButton data-slot="button" className={classNames} {...props} />;
}

export { Button, buttonVariants, PressButton, PressTarget };
