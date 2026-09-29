'use client';

import { Toaster as SonnerToaster, toast } from 'sonner';

/** App toast host. Colors follow the design tokens in both themes. */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'group !bg-panel !border !border-border !text-fg !shadow-popover !rounded-lg',
          description: '!text-fg-muted',
          actionButton: '!bg-accent !text-accent-fg',
          cancelButton: '!bg-surface-hover !text-fg',
          error: '!text-[color:var(--tone-red-fg)]',
          success: '!text-[color:var(--tone-green-fg)]',
        },
      }}
    />
  );
}

export { toast };
