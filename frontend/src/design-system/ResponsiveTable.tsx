import { Children, createContext, cloneElement, isValidElement, useContext, type ReactElement, type ReactNode, type TableHTMLAttributes, type HTMLAttributes, type TdHTMLAttributes } from "react";

const ColumnLabels = createContext<string[]>([]);
type NodeProps = { children?: ReactNode; "aria-label"?: string };

function labelText(node: ReactNode): string {
  return Children.toArray(node).map((child) => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    if (!isValidElement<NodeProps>(child)) return "";
    return child.props["aria-label"] ?? labelText(child.props.children);
  }).join("").trim();
}

function columnLabels(node: ReactNode): string[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<NodeProps>(child)) return [];
    return child.type === "th" ? [child.props["aria-label"] ?? labelText(child.props.children)] : columnLabels(child.props.children);
  });
}

/** Keep one set of controls: a table on desktop, labelled records on phones. */
export function ResponsiveTable({ children, className = "", ...props }: TableHTMLAttributes<HTMLTableElement>) {
  const head = Children.toArray(children).find((child) => isValidElement(child) && child.type === "thead");
  return <ColumnLabels.Provider value={columnLabels(head)}>
    <table {...props} className={`responsive-table ${className}`} role="table">{children}</table>
  </ColumnLabels.Provider>;
}

export function ResponsiveRow({ children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  const labels = useContext(ColumnLabels);
  let column = 0;
  return <tr {...props} role="row">{Children.map(children, (child) => {
    if (!isValidElement<TdHTMLAttributes<HTMLTableCellElement>>(child) || (child.type !== "td" && child.type !== "th")) return child;
    const label = labels[column] ?? "";
    const span = child.props.colSpan ?? 1;
    column += span;
    if (child.type !== "td") return child;
    return cloneElement(child as ReactElement<TdHTMLAttributes<HTMLTableCellElement> & { "data-label"?: string }>, {
      "data-label": span === 1 ? label : undefined,
      role: "cell"
    });
  })}</tr>;
}
