import { Outlet } from "react-router";

export function meta() {
  return [{ title: "Pack Studio" }];
}

export default function StudioLayout() {
  return <Outlet />;
}
