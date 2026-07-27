import { Bike, FileText, Pizza, Settings, Store, Tag, PieChart } from "lucide-react";

import React, {
  ForwardRefExoticComponent,
  PropsWithChildren,
  RefAttributes,
} from "react";

export const PizzaIcon: ForwardRefExoticComponent<
  RefAttributes<SVGSVGElement>
> = React.forwardRef<SVGSVGElement>((props: PropsWithChildren, ref) => (
  <Pizza ref={ref} size={16} {...props} />
));

export const BikeIcon: ForwardRefExoticComponent<RefAttributes<SVGSVGElement>> =
  React.forwardRef<SVGSVGElement>((props: PropsWithChildren, ref) => (
    <Bike ref={ref} size={16} {...props} />
  ));

export const StoreIcon: ForwardRefExoticComponent<
  RefAttributes<SVGSVGElement>
> = React.forwardRef<SVGSVGElement>((props: PropsWithChildren, ref) => (
  <Store ref={ref} size={16} {...props} />
));

export const SettingsIcon: ForwardRefExoticComponent<
  RefAttributes<SVGSVGElement>
> = React.forwardRef<SVGSVGElement>((props: PropsWithChildren, ref) => (
  <Settings ref={ref} size={16} {...props} />
));

export const OffersIcon: ForwardRefExoticComponent<
  RefAttributes<SVGSVGElement>
> = React.forwardRef<SVGSVGElement>((props: PropsWithChildren, ref) => (
  <Tag ref={ref} size={16} {...props} />
));

export const CmsIcon: ForwardRefExoticComponent<
  RefAttributes<SVGSVGElement>
> = React.forwardRef<SVGSVGElement>((props: PropsWithChildren, ref) => (
  <FileText ref={ref} size={16} {...props} />
));

export const ChartPieIcon: ForwardRefExoticComponent<
  RefAttributes<SVGSVGElement>
> = React.forwardRef<SVGSVGElement>((props: PropsWithChildren, ref) => (
  <PieChart ref={ref} size={16} {...props} />
));
