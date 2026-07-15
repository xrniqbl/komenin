"use client";

import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";
import { cva } from "class-variance-authority";
import { ChevronDownIcon } from "lucide-react";
import type React from "react";

import { cn } from "@/lib/utils";

function NavigationMenu({
  className,
  children,
  ...props
}: NavigationMenuPrimitive.Root.Props): React.ReactElement {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      className={cn(
        "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
        className,
      )}
      {...props}
    >
      {children}
      <NavigationMenuPositioner>
        <NavigationMenuPopup>
          <NavigationMenuViewport />
        </NavigationMenuPopup>
      </NavigationMenuPositioner>
    </NavigationMenuPrimitive.Root>
  );
}

function NavigationMenuList({
  className,
  ...props
}: NavigationMenuPrimitive.List.Props): React.ReactElement {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn(
        "group flex flex-1 list-none items-center justify-center gap-1",
        className,
      )}
      {...props}
    />
  );
}

function NavigationMenuItem({
  className,
  ...props
}: NavigationMenuPrimitive.Item.Props): React.ReactElement {
  return (
    <NavigationMenuPrimitive.Item
      data-slot="navigation-menu-item"
      className={cn("relative", className)}
      {...props}
    />
  );
}

const navigationMenuTriggerStyle = cva(
  "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-[color,box-shadow] outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-popup-open:bg-accent/50 data-popup-open:text-accent-foreground data-popup-open:hover:bg-accent data-popup-open:focus:bg-accent",
);

function NavigationMenuTrigger({
  className,
  children,
  ...props
}: NavigationMenuPrimitive.Trigger.Props): React.ReactElement {
  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      {...props}
    >
      {children}
      <NavigationMenuPrimitive.Icon
        data-slot="navigation-menu-icon"
        className="relative top-px ml-1 size-3 transition duration-300 data-popup-open:rotate-180"
      >
        <ChevronDownIcon aria-hidden="true" className="size-3" />
      </NavigationMenuPrimitive.Icon>
    </NavigationMenuPrimitive.Trigger>
  );
}

function NavigationMenuContent({
  className,
  ...props
}: NavigationMenuPrimitive.Content.Props): React.ReactElement {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={cn(
        "w-full p-2 pr-2.5 transition-[opacity,transform,translate] duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:data-[activation-direction=left]:translate-x-[50%] data-ending-style:data-[activation-direction=right]:translate-x-[-50%] data-starting-style:data-[activation-direction=left]:translate-x-[-50%] data-starting-style:data-[activation-direction=right]:translate-x-[50%] md:w-auto",
        className,
      )}
      {...props}
    />
  );
}

function NavigationMenuPositioner({
  className,
  side = "bottom",
  sideOffset = 8,
  align = "center",
  children,
  ...props
}: NavigationMenuPrimitive.Positioner.Props): React.ReactElement {
  return (
    <NavigationMenuPrimitive.Portal>
      <NavigationMenuPrimitive.Positioner
        data-slot="navigation-menu-positioner"
        side={side}
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-300 ease-in-out data-instant:transition-none",
          className,
        )}
        {...props}
      >
        {children}
      </NavigationMenuPrimitive.Positioner>
    </NavigationMenuPrimitive.Portal>
  );
}

function NavigationMenuPopup({
  className,
  ...props
}: NavigationMenuPrimitive.Popup.Props): React.ReactElement {
  return (
    <NavigationMenuPrimitive.Popup
      data-slot="navigation-menu-popup"
      className={cn(
        "relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) rounded-md border bg-popover text-popover-foreground shadow outline-none transition-[opacity,transform,width,height,scale,translate] duration-200 ease-in-out data-ending-style:scale-90 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-90 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function NavigationMenuViewport({
  className,
  ...props
}: NavigationMenuPrimitive.Viewport.Props): React.ReactElement {
  return (
    <NavigationMenuPrimitive.Viewport
      data-slot="navigation-menu-viewport"
      className={cn("relative size-full overflow-hidden", className)}
      {...props}
    />
  );
}

function NavigationMenuLink({
  className,
  ...props
}: NavigationMenuPrimitive.Link.Props): React.ReactElement {
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={cn(
        "flex flex-col gap-1 rounded-sm p-2 text-sm transition-all outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 data-active:bg-accent/50 data-active:text-accent-foreground data-active:hover:bg-accent data-active:focus:bg-accent [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function NavigationMenuIndicator({
  className,
  ...props
}: NavigationMenuPrimitive.Arrow.Props): React.ReactElement {
  return (
    <NavigationMenuPrimitive.Arrow
      data-slot="navigation-menu-indicator"
      className={cn(
        "flex h-2.5 w-2.5 items-end justify-center data-ending-style:opacity-0 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    >
      <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
    </NavigationMenuPrimitive.Arrow>
  );
}

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
  NavigationMenuPositioner,
  NavigationMenuPopup,
  navigationMenuTriggerStyle,
};