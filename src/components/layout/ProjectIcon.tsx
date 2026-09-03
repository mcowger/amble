import React, { useState, useEffect } from "react";
import { Folder } from "lucide-react";
import type { ProjectItem } from "../../lib/paseo/types";
import type { PaseoClient } from "../../lib/paseo/client";
import { usePaseo } from "../../context/PaseoContext";
import { cn } from "../../lib/utils";

interface ProjectIconProps {
  project?: ProjectItem | null;
  client?: PaseoClient | null;
  className?: string;
}

export function ProjectIcon({ project, client: propClient, className }: ProjectIconProps) {
  const { client: contextClient } = usePaseo();
  const client = propClient || contextClient;
  const [iconUri, setIconUri] = useState<string | null>(null);

  useEffect(() => {
    if (!project || !client) {
      setIconUri(null);
      return;
    }

    let cancelled = false;

    const loadIcon = async () => {
      try {
        let res: { icon: { mimeType: string; data: string } | null } | null = null;
        if (project.rootPath) {
          res = await client.requestProjectIcon(project.rootPath).catch(() => null);
        }
        if (!res?.icon && project.id) {
          res = await client.getProjectIcon(project.id).catch(() => null);
        }
        if (!cancelled && res?.icon) {
          setIconUri(`data:${res.icon.mimeType};base64,${res.icon.data}`);
        }
      } catch {}
    };

    loadIcon();

    return () => {
      cancelled = true;
    };
  }, [project?.id, project?.rootPath, client]);

  if (iconUri) {
    return (
      <img
        src={iconUri}
        alt=""
        className={cn("w-3.5 h-3.5 object-contain shrink-0 rounded-xs", className)}
      />
    );
  }

  return <Folder className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0", className)} />;
}
