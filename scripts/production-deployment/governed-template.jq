def governed_annotation_keys:
  [
    "autoscaling.knative.dev/maxScale",
    "autoscaling.knative.dev/minScale",
    "run.googleapis.com/execution-environment",
    "run.googleapis.com/startup-cpu-boost"
  ];

def annotation_map($value; $location):
  if $value == null then {}
  elif ($value | type) == "object" then $value
  else error("governed annotations at \($location) must be an object")
  end;

def reject_malformed_governed_values($annotations; $location):
  [governed_annotation_keys[] as $key
    | select($annotations[$key] != null and ($annotations[$key] | type) != "string")
    | $key] as $malformed
  | if ($malformed | length) == 0 then $annotations
    else error("governed annotation at \($location) must be a string: \($malformed | join(","))")
    end;

def reject_conflicts($primary; $alternate):
  [governed_annotation_keys[] as $key
    | select($primary[$key] != null and $alternate[$key] != null and $primary[$key] != $alternate[$key])
    | $key] as $conflicts
  | if ($conflicts | length) == 0 then empty
    else error("conflicting governed annotation locations: \($conflicts | join(","))")
    end;

def resolved_shape:
  ((.spec.template.spec.containers? | type) == "array") as $is_service
  | ((.spec.containers? | type) == "array") as $is_revision
  | if ($is_service and $is_revision) then
    error("ambiguous Cloud Run resource shape")
  elif $is_service then
    annotation_map(.spec.template.metadata.annotations?; ".spec.template.metadata.annotations") as $primary
    | annotation_map(.metadata.annotations?; ".metadata.annotations") as $alternate
    | reject_conflicts($primary; $alternate),
      {
        resourceShape: "service",
        spec: .spec.template.spec,
        annotations: reject_malformed_governed_values($primary; ".spec.template.metadata.annotations")
      }
  elif $is_revision then
    annotation_map(.metadata.annotations?; ".metadata.annotations") as $primary
    | annotation_map(.spec.template.metadata.annotations?; ".spec.template.metadata.annotations") as $alternate
    | reject_conflicts($primary; $alternate),
      {
        resourceShape: "revision",
        spec: .spec,
        annotations: reject_malformed_governed_values($primary; ".metadata.annotations")
      }
  else
    error("unrecognized Cloud Run resource shape")
  end;

resolved_shape as $resolved
| ($resolved.spec) as $spec
| ($resolved.annotations) as $annotations
| ($spec.containers[0]) as $container
| {
    serviceAccount: $spec.serviceAccountName,
    containerConcurrency: $spec.containerConcurrency,
    timeoutSeconds: $spec.timeoutSeconds,
    ports: $container.ports,
    resources: $container.resources,
    envNames: ([$container.env[]?.name] | sort),
    secretRefs: ([$container.env[]? | select(.valueFrom.secretKeyRef) | {
      name,
      secret: .valueFrom.secretKeyRef.name,
      version: .valueFrom.secretKeyRef.key
    }] | sort_by(.name)),
    startupProbe: $container.startupProbe,
    livenessProbe: $container.livenessProbe,
    maxScale: $annotations["autoscaling.knative.dev/maxScale"],
    minScale: $annotations["autoscaling.knative.dev/minScale"],
    executionEnvironment: $annotations["run.googleapis.com/execution-environment"],
    startupCpuBoost: $annotations["run.googleapis.com/startup-cpu-boost"]
  }
