'use client';

import { DropdownMenu as Menu } from 'radix-ui';
import { Check } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/cn';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;

const contentClass =
  'z-50 min-w-[11rem] overflow-hidden rounded-lg border border-border bg-panel p-1 shadow-popover data-[state=open]:animate-in';
const itemClass =
  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-fg outline-none transition-colors focus:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-fg-subtle';

export function DropdownMenuContent({ className, align = 'end', sideOffset = 6, ...props }: React.ComponentPropsWithoutRef<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content align={align} sideOffset={sideOffset} className={cn(contentClass, className)} {...props} />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({ className, tone, ...props }: React.ComponentPropsWithoutRef<typeof Menu.Item> & { tone?: 'danger' }) {
  return <Menu.Item className={cn(itemClass, tone === 'danger' && 'text-[color:var(--tone-red-fg)] focus:bg-[var(--tone-red-bg)]', className)} {...props} />;
}

export function DropdownMenuCheckboxItem({ className, children, checked, ...props }: React.ComponentPropsWithoutRef<typeof Menu.CheckboxItem>) {
  return (
    <Menu.CheckboxItem className={cn(itemClass, 'pl-2', className)} checked={checked} {...props}>
      <span className="flex size-4 items-center justify-center">
        <Menu.ItemIndicator>
          <Check className="size-3.5 text-accent" />
        </Menu.ItemIndicator>
      </span>
      {children}
    </Menu.CheckboxItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof Menu.Label>) {
  return <Menu.Label className={cn('px-2.5 py-1.5 text-xs font-medium text-fg-subtle', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}
