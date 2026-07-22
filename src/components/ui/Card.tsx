import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type BaseProps = {
  children: ReactNode;
  className?: string;
};

type DivProps = BaseProps & { href?: undefined } & Omit<
    ComponentPropsWithoutRef<"div">,
    "children" | "className"
  >;

type LinkProps = BaseProps & { href: string };

const BASE =
  "rounded-2xl border border-border bg-surface p-5 transition";
const INTERACTIVE = "hover:bg-surface-elev";

function compose(extra?: string, interactive = false) {
  return [BASE, interactive ? INTERACTIVE : "", extra ?? ""]
    .filter(Boolean)
    .join(" ");
}

export function Card(props: DivProps | LinkProps) {
  if ("href" in props && props.href) {
    const { href, children, className } = props;
    return (
      <Link href={href} className={compose(className, true)}>
        {children}
      </Link>
    );
  }
  const { children, className, ...rest } = props as DivProps;
  return (
    <div className={compose(className)} {...rest}>
      {children}
    </div>
  );
}
