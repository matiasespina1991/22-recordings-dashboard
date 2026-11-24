"use client";
import type { ReactNode } from "react";
import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { IconTrash, IconPencil, IconCheck, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStorageAssetSrc } from "@/hooks/use-storage-asset-src";
import { updateGalleryMedia, type MediaDoc } from "@/lib/media-upload";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function getPreviewPath(media: MediaDoc) {
  if (media.type === "video") {
    return media.paths?.poster?.storagePath ?? null;
  }

  return (
    media.paths?.derivatives?.webp_thumb?.storagePath ??
    media.paths?.derivatives?.webp_small?.storagePath ??
    media.paths?.original?.storagePath ??
    null
  );
}

export function MediaPreviewCard({
  media,
  onRemove,
  actions,
  onAltUpdate,
}: {
  media: MediaDoc;
  onRemove?: () => void;
  actions?: ReactNode;
  onAltUpdate?: (alt: string) => void;
}) {
  const previewPath = getPreviewPath(media);
  const { src, hasSource, handleError } = useStorageAssetSrc(
    previewPath ? { storagePath: previewPath } : null,
    { preferDirect: false },
  );
  const [isEditingAlt, setIsEditingAlt] = useState(false);
  const [localAlt, setLocalAlt] = useState(media.alt ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAlt = async () => {
    if (localAlt === media.alt) {
      setIsEditingAlt(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateGalleryMedia(
        media,
        media.title ?? media.originalFilename ?? media.id,
        localAlt,
      );
      onAltUpdate?.(localAlt);
      setIsEditingAlt(false);
      toast.success("Descripción actualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar.");
      setLocalAlt(media.alt ?? "");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border-border/60 bg-card flex max-w-[25rem] min-w-0 flex-col gap-2 rounded-lg border px-3 py-2 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="bg-muted flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md">
          {hasSource ? (
            <img
              src={src}
              alt={media.id}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={handleError}
            />
          ) : (
            <span className="text-muted-foreground text-[11px]">
              {media.processed ? "Sin vista previa" : "Procesando…"}
            </span>
          )}
        </div>
        <div className="grid flex-1">
          <div className="text-sm font-medium">
            {media.type === "video" ? "Video" : "Imagen"}
          </div>
          <div className="text-muted-foreground truncate text-xs">
            {media.id}
          </div>
        </div>
        {actions ? (
          actions
        ) : onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="cursor-pointer"
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {isEditingAlt ? (
        <div className="flex gap-2">
          <Input
            value={localAlt}
            onChange={(e) => setLocalAlt(e.target.value.slice(0, 300))}
            placeholder="Descripción para accesibilidad..."
            className="text-sm"
            disabled={isSaving}
            maxLength={300}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={handleSaveAlt}
                disabled={isSaving}
                className="shrink-0"
              >
                <IconCheck className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Guardar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => {
                  setIsEditingAlt(false);
                  setLocalAlt(media.alt ?? "");
                }}
                disabled={isSaving}
                className="shrink-0"
              >
                <IconX className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cancelar</TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {media.alt ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {media.alt}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic">
                Sin descripción
              </p>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  setLocalAlt(media.alt ?? "");
                  setIsEditingAlt(true);
                }}
                className="shrink-0"
              >
                <IconPencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar descripción</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

export function SortableAttachmentCard({
  media,
  onRemove,
  onAltUpdate,
}: {
  media: MediaDoc;
  onRemove: () => void;
  onAltUpdate?: (alt: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: media.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging ? "opacity-70" : null)}
    >
      <MediaPreviewCard
        media={media}
        onRemove={onRemove}
        onAltUpdate={onAltUpdate}
        actions={
          <div className="flex items-center gap-1">
            <button
              type="button"
              ref={setActivatorNodeRef}
              className="text-muted-foreground hover:text-foreground inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md transition-colors active:cursor-grabbing"
              aria-label="Reordenar adjunto"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="cursor-pointer"
            >
              <IconTrash className="h-4 w-4" />
            </Button>
          </div>
        }
      />
    </div>
  );
}
