/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ["@medusajs/ui", "react-aria"],
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "3000",
      },
      {
        protocol: "https",
        hostname: "robohash.org",
      },
      {
        protocol: "https",
        hostname: "caketohome.vercel.app",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  webpack: (config, { webpack }) => {
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^react-aria\/(.*)/, (resource) => {
        if (resource.request.includes("private")) {
          resource.request = resource.request.replace(/^react-aria\/private\/([^\/]+)\/.*/, "@react-aria/$1");
          return;
        }
        const sub = resource.request.replace(/^react-aria\//, "");
        const subLower = sub.toLowerCase();

        if (subLower.includes("visuallyhidden")) {
          resource.request = "@react-aria/visually-hidden";
          return;
        }
        if (subLower.includes("dom") || subLower.includes("ref") || subLower.includes("merge") || subLower.includes("chain") || subLower.includes("useid") || subLower.includes("slot") || subLower.includes("util")) {
          resource.request = "@react-aria/utils";
          return;
        }
        if (subLower.includes("table")) {
          resource.request = "@react-aria/table";
          return;
        }
        if (subLower.includes("tab")) {
          resource.request = "@react-aria/tabs";
          return;
        }
        if (subLower.includes("ssr")) {
          resource.request = "@react-aria/ssr";
          return;
        }
        if (subLower.includes("selection") || subLower.includes("listkeyboarddelegate")) {
          resource.request = "@react-aria/selection";
          return;
        }
        if (subLower.includes("filter") || subLower.includes("collator") || subLower.includes("string") || subLower.includes("i18n") || subLower.includes("locale") || subLower.includes("formatter")) {
          resource.request = "@react-aria/i18n";
          return;
        }
        if (subLower.includes("focusscope") || subLower.includes("focusring")) {
          resource.request = "@react-aria/focus";
          return;
        }
        if (subLower.includes("calendar")) {
          resource.request = "@react-aria/calendar";
          return;
        }
        if (subLower.includes("date") || subLower.includes("time")) {
          resource.request = "@react-aria/datepicker";
          return;
        }
        if (subLower.includes("dialog")) {
          resource.request = "@react-aria/dialog";
          return;
        }
        if (subLower.includes("portal") || subLower.includes("popover") || subLower.includes("preventscroll") || subLower.includes("overlay") || subLower.includes("modal")) {
          resource.request = "@react-aria/overlays";
          return;
        }
        if (subLower.includes("button") || subLower.includes("toggle")) {
          resource.request = "@react-aria/button";
          return;
        }
        if (subLower.includes("breadcrumb")) {
          resource.request = "@react-aria/breadcrumbs";
          return;
        }
        if (subLower.includes("checkbox")) {
          resource.request = "@react-aria/checkbox";
          return;
        }
        if (subLower.includes("radio")) {
          resource.request = "@react-aria/radio";
          return;
        }
        if (subLower.includes("switch")) {
          resource.request = "@react-aria/switch";
          return;
        }
        if (subLower.includes("searchfield")) {
          resource.request = "@react-aria/searchfield";
          return;
        }
        if (subLower.includes("numberfield")) {
          resource.request = "@react-aria/numberfield";
          return;
        }
        if (subLower.includes("textfield")) {
          resource.request = "@react-aria/textfield";
          return;
        }
        if (subLower.includes("field") || subLower.includes("label")) {
          resource.request = "@react-aria/label";
          return;
        }
        if (subLower.includes("slider")) {
          resource.request = "@react-aria/slider";
          return;
        }
        if (subLower.includes("gridlist")) {
          resource.request = "@react-aria/gridlist";
          return;
        }
        if (subLower.includes("listbox")) {
          resource.request = "@react-aria/listbox";
          return;
        }
        if (subLower.includes("combobox")) {
          resource.request = "@react-aria/combobox";
          return;
        }
        if (subLower.includes("menu")) {
          resource.request = "@react-aria/menu";
          return;
        }
        if (subLower.includes("tooltip")) {
          resource.request = "@react-aria/tooltip";
          return;
        }
        if (subLower.includes("link")) {
          resource.request = "@react-aria/link";
          return;
        }
        if (subLower.includes("meter")) {
          resource.request = "@react-aria/meter";
          return;
        }
        if (subLower.includes("progress")) {
          resource.request = "@react-aria/progress";
          return;
        }
        if (subLower.includes("separator")) {
          resource.request = "@react-aria/separator";
          return;
        }
        if (subLower.includes("tag")) {
          resource.request = "@react-aria/tag";
          return;
        }
        if (subLower.includes("clipboard") || subLower.includes("drag") || subLower.includes("drop") || subLower.includes("dnd")) {
          resource.request = "@react-aria/dnd";
          return;
        }
        if (subLower.includes("interact") || subLower.includes("hover") || subLower.includes("focus") || subLower.includes("interaction") || subLower.includes("press") || subLower.includes("keyboard") || subLower.includes("move")) {
          resource.request = "@react-aria/interactions";
          return;
        }
        if (subLower.includes("select")) {
          resource.request = "@react-aria/select";
          return;
        }
        resource.request = `@react-aria/${subLower}`;
      })
    );
    return config;
  },
  async rewrites() {
    return [];
  },
};

export default nextConfig;
