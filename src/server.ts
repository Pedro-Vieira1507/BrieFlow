import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createStartHandler({
  createServerEntry,
})(defaultStreamHandler);