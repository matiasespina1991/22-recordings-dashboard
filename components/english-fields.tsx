"use client";
import type { ReactNode } from "react";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EnglishTranslation } from "@/lib/content/translations";
export function EnglishFields({
  value,
  onChange,
  page,
  disabled,
  children,
  artist = false,
}: {
  value: EnglishTranslation;
  onChange: (value: EnglishTranslation) => void;
  page: boolean;
  disabled: boolean;
  children: ReactNode;
  artist?: boolean;
}) {
  const id = useId();
  const fields: {
    key: keyof EnglishTranslation;
    label: string;
    max: number;
    multiline?: boolean;
  }[] = [
    { key: "title", label: "Título", max: 160 },
    {
      key: page ? "intro" : "summary",
      label: page ? "Introducción" : "Resumen",
      max: 1000,
      multiline: true,
    },
    {
      key: "seoDescription",
      label: "Descripción para buscadores",
      max: 320,
      multiline: true,
    },
    ...(!page && !artist
      ? [
          { key: "venue" as const, label: "Sala", max: 300 },
          { key: "country" as const, label: "País", max: 100 },
        ]
      : []),
    ...(artist
      ? [{ key: "residence" as const, label: "Residencia", max: 300 }]
      : []),
    ...(page
      ? [{ key: "imageAlt" as const, label: "Descripción de imagen", max: 300 }]
      : []),
  ];
  return (
    <section
      className="space-y-5 border-t pt-6"
      aria-labelledby={`${id}-heading`}
    >
      <h2 id={`${id}-heading`} className="text-lg font-semibold">
        Traducción al inglés
      </h2>

      {fields.map((field) => (
        <div key={field.key} className="space-y-2">
          <label htmlFor={`${id}-${field.key}`} className="text-sm font-medium">
            {field.label} · EN
          </label>
          {field.multiline ? (
            <Textarea
              id={`${id}-${field.key}`}
              disabled={disabled}
              value={value[field.key] || ""}
              maxLength={field.max}
              rows={field.key === "body" ? 10 : 3}
              onChange={(event) =>
                onChange({
                  ...value,
                  [field.key]: event.target.value,
                  ...(field.key === "body"
                    ? { bodyFormat: "text" as const }
                    : {}),
                })
              }
            />
          ) : (
            <Input
              id={`${id}-${field.key}`}
              disabled={disabled}
              maxLength={field.max}
              value={value[field.key] || ""}
              onChange={(event) =>
                onChange({ ...value, [field.key]: event.target.value })
              }
            />
          )}
        </div>
      ))}
      {children}
    </section>
  );
}
