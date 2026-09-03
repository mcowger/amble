import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const meterVariants = cva(
  "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
  {
    variants: {
      variant: {
        default: "bg-secondary",
        success: "bg-emerald-500/20",
        warning: "bg-amber-500/20",
        danger: "bg-destructive/20",
      },
      size: {
        sm: "h-1.5",
        default: "h-4",
        lg: "h-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const meterIndicatorVariants = cva("h-full w-full flex-1 transition-all rounded-full", {
  variants: {
    variant: {
      default: "bg-primary",
      success: "bg-emerald-500",
      warning: "bg-amber-500",
      danger: "bg-destructive",
    },
    size: {
      sm: "h-1.5",
      default: "h-4",
      lg: "h-6",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface MeterProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof meterVariants> {
  value: number;
  max?: number;
  label?: string;
  valueLabel?: string;
  color?: string;
}

const Meter = React.forwardRef<HTMLDivElement, MeterProps>(
  (
    {
      className,
      value,
      max = 100,
      label,
      valueLabel,
      variant,
      size,
      color,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(100, Math.max(0, (value / (max || 1)) * 100));
    return (
      <div className="space-y-2">
        {(label || valueLabel) && (
          <div className="flex items-center justify-between text-sm">
            {label && <div>{label}</div>}
            {valueLabel && <div>{valueLabel}</div>}
          </div>
        )}
        <div
          ref={ref}
          className={cn(meterVariants({ variant, size, className }))}
          {...props}
        >
          <div
            className={cn(meterIndicatorVariants({ variant, size }))}
            style={{
              width: `${percentage}%`,
              backgroundColor: color,
            }}
          />
        </div>
      </div>
    );
  }
);
Meter.displayName = "Meter";

export { Meter };
