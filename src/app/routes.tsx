import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { Home } from "./pages/Home";
import { Branches } from "./pages/Branches";
import { Queue } from "./pages/Queue";
import { PreCheck } from "./pages/PreCheck";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "branches", Component: Branches },
      { path: "queue", Component: Queue },
      { path: "pre-check", Component: PreCheck },
    ],
  },
]);
