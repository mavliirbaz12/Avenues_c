"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Upload, Star, Trash2, GripVertical, Loader2 } from "lucide-react";
import { reorderImages, setPrimaryImage, deleteImage } from "@/app/actions/admin/products";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

export type ImageRow = {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
  position: number;
};

/**
 * Product image management: upload, drag to reorder, set primary, delete.
 * Order changes are optimistic — the grid moves immediately, the server
 * action persists, and a failure rolls the local order back.
 */
export function ImageManager({
  productId,
  images: initial,
  uploadEnabled,
}: {
  productId: string;
  images: ImageRow[];
  uploadEnabled: boolean;
}) {
  const [images, setImages] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useUI((s) => s.toast);
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.set("file", file);
      form.set("productId", productId);

      try {
        const res = await fetch("/api/admin/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed.");
        setImages((prev) => [...prev, data.image]);
      } catch (err) {
        toast({ title: (err as Error).message, tone: "danger" });
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex((i) => i.id === active.id);
    const newIndex = images.findIndex((i) => i.id === over.id);
    const next = arrayMove(images, oldIndex, newIndex);
    const prev = images;
    setImages(next);

    startTransition(async () => {
      try {
        await reorderImages(productId, next.map((i) => i.id));
      } catch {
        setImages(prev);
        toast({ title: "Reorder didn't save — try again.", tone: "danger" });
      }
    });
  }

  function makePrimary(imageId: string) {
    setImages((prev) => prev.map((i) => ({ ...i, isPrimary: i.id === imageId })));
    startTransition(async () => {
      try {
        await setPrimaryImage(productId, imageId);
        toast({ title: "Primary image updated." });
      } catch {
        toast({ title: "That didn't save — try again.", tone: "danger" });
        router.refresh();
      }
    });
  }

  function remove(imageId: string) {
    const prev = images;
    setImages((p) => p.filter((i) => i.id !== imageId));
    startTransition(async () => {
      try {
        await deleteImage(imageId);
        toast({ title: "Image deleted." });
      } catch {
        setImages(prev);
        toast({ title: "Delete failed — try again.", tone: "danger" });
      }
    });
  }

  return (
    <section className="border border-line p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-sans text-sm uppercase tracking-wide2 text-bone">Images</h2>
          <p className="mt-1 font-sans text-xs text-stone-dark">
            Drag to reorder. The starred image leads everywhere the product appears;
            until a photo is uploaded the storefront shows the engraved bottle.
          </p>
        </div>

        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={(e) => onUpload(e.target.files)}
            className="sr-only"
            id="image-upload"
            disabled={!uploadEnabled || uploading}
          />
          <label
            htmlFor="image-upload"
            className={cn(
              "btn btn-outline btn-sm",
              (!uploadEnabled || uploading) && "pointer-events-none opacity-40",
            )}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin-slow" strokeWidth={1.8} />
            ) : (
              <Upload className="h-3.5 w-3.5" strokeWidth={1.8} />
            )}
            {uploading ? "Uploading" : "Upload images"}
          </label>
        </div>
      </div>

      {!uploadEnabled && (
        <p className="mt-4 border border-warning/40 bg-warning/[0.06] px-4 py-3 font-sans text-xs leading-relaxed text-warning">
          Image upload needs Cloudinary keys in .env (CLOUDINARY_CLOUD_NAME, API_KEY,
          API_SECRET). Until then the storefront uses the engraved bottle placeholder.
        </p>
      )}

      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((image) => (
                <SortableImage
                  key={image.id}
                  image={image}
                  onMakePrimary={() => makePrimary(image.id)}
                  onDelete={() => remove(image.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function SortableImage({
  image,
  onMakePrimary,
  onDelete,
}: {
  image: ImageRow;
  onMakePrimary: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative border bg-ink-deep",
        image.isPrimary ? "border-gold/60" : "border-line",
        isDragging && "z-10 opacity-80 shadow-lift",
      )}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <Image src={image.url} alt={image.alt} fill sizes="200px" className="object-cover" />
      </div>

      {image.isPrimary && (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 bg-ink-deep/85 px-2 py-1 font-sans text-[0.5625rem] uppercase tracking-wide2 text-gold">
          <Star className="h-3 w-3" fill="currentColor" strokeWidth={0} />
          Primary
        </span>
      )}

      <div className="flex items-center justify-between border-t border-line px-2 py-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="cursor-grab p-1 text-stone-dark transition-colors hover:text-bone active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" strokeWidth={1.6} />
        </button>

        <div className="flex items-center gap-1">
          {!image.isPrimary && (
            <button
              type="button"
              onClick={onMakePrimary}
              aria-label="Set as primary image"
              className="p-1 text-stone-dark transition-colors hover:text-gold"
            >
              <Star className="h-3.5 w-3.5" strokeWidth={1.6} />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete image"
            className="p-1 text-stone-dark transition-colors hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
          </button>
        </div>
      </div>
    </li>
  );
}
