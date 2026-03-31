"use client";

import { useState, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface BaseInputProps {
  label: string;
  error?: string;
  className?: string;
}

type InputFieldProps = BaseInputProps & Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & { multiline?: false };
type TextAreaFieldProps = BaseInputProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & { multiline: true };

type Props = InputFieldProps | TextAreaFieldProps;

export default function Input(props: Props) {
  const { label, error, className, multiline, ...rest } = props;
  const [focused, setFocused] = useState(false);
  const autoId = useId();
  const inputId = ("id" in rest && rest.id) || autoId;
  const errorId = `${inputId}-error`;
  const hasValue = Boolean(
    "value" in rest && rest.value
  );
  const isActive = focused || hasValue;

  const baseClasses = cn(
    "w-full bg-transparent border-b-2 border-gray-700 px-0 py-3 text-white font-anomalia",
    "transition-all duration-300 outline-none",
    "focus:border-cyan",
    error && "border-red-500",
    className
  );

  return (
    <div className="relative">
      <label
        htmlFor={inputId}
        className={cn(
          "absolute right-0 transition-all duration-300 pointer-events-none font-anomalia",
          isActive
            ? "top-0 text-xs text-cyan -translate-y-full"
            : "top-3 text-base text-gray-400"
        )}
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          id={inputId}
          className={cn(baseClasses, "resize-none min-h-[120px]")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onFocus={(e) => {
            setFocused(true);
            (rest as TextareaHTMLAttributes<HTMLTextAreaElement>).onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            (rest as TextareaHTMLAttributes<HTMLTextAreaElement>).onBlur?.(e);
          }}
        />
      ) : (
        <input
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
          id={inputId}
          className={baseClasses}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onFocus={(e) => {
            setFocused(true);
            (rest as InputHTMLAttributes<HTMLInputElement>).onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            (rest as InputHTMLAttributes<HTMLInputElement>).onBlur?.(e);
          }}
        />
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-500" role="alert">{error}</p>
      )}
    </div>
  );
}
