import { getClient } from "@/api/AxiosClient";
import { TaskGenerationApiResponse } from "@/api/types";
import { TaskCreateLayout } from "./TaskCreateLayout";
import { CreateNewTaskForm } from "./CreateNewTaskForm";
import { useCredentialGetter } from "@/hooks/useCredentialGetter";
import { useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getSampleForInitialFormValues } from "../data/sampleTaskData";
import { SampleCase, sampleCases } from "../types";
import { SavedTaskForm } from "./SavedTaskForm";
import { WorkflowParameter } from "@/routes/workflows/types/workflowTypes";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createNewTaskFormSchema, CreateNewTaskFormValues } from "./taskFormTypes";
import { ProxyLocation } from "@/api/types";

function TaskCreateWithSidebar() {
  const { template } = useParams();
  const credentialGetter = useCredentialGetter();
  const location = useLocation();

  const form = useForm<CreateNewTaskFormValues>({
    resolver: zodResolver(createNewTaskFormSchema),
    defaultValues: {
      url: "https://www.example.com",
      navigationGoal: "",
      dataExtractionGoal: "",
      navigationPayload: null,
      extractedInformationSchema: null,
      webhookCallbackUrl: null,
      totpIdentifier: null,
      errorCodeMapping: null,
      proxyLocation: ProxyLocation.Residential,
      includeActionHistoryInVerification: false,
      maxScreenshotScrolls: null,
      extraHttpHeaders: null,
      cdpAddress: null,
      browser_config: {
        type: "skyvern_default"
      },
    }
  });

  const { data, isFetching } = useQuery({
    queryKey: ["savedTasks", template],
    queryFn: async () => {
      const client = await getClient(credentialGetter);
      return client
        .get(`/workflows/${template}`)
        .then((response) => response.data);
    },
    enabled: !!template && !sampleCases.includes(template as SampleCase),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  if (!template) {
    return <div>Invalid template</div>;
  }

  if (template === "from-prompt") {
    const promptData = location.state?.data as TaskGenerationApiResponse;
    if (!promptData?.url) {
      return <div>Something went wrong, please try again</div>;
    }

    return (
      <TaskCreateLayout formControl={form.control}>
        <div className="space-y-4">
          <header>
            <h1 className="text-3xl">Create New Task</h1>
          </header>
          <CreateNewTaskForm
            key={template}
            initialValues={{
              url: promptData.url,
              navigationGoal: promptData.navigation_goal,
              dataExtractionGoal: promptData.data_extraction_goal,
              navigationPayload:
                typeof promptData.navigation_payload === "string"
                  ? promptData.navigation_payload
                  : JSON.stringify(promptData.navigation_payload, null, 2),
              extractedInformationSchema: JSON.stringify(
                promptData.extracted_information_schema,
                null,
                2,
              ),
              errorCodeMapping: null,
              totpIdentifier: null,
              webhookCallbackUrl: null,
              proxyLocation: null,
              includeActionHistoryInVerification: null,
              maxScreenshotScrolls: null,
              extraHttpHeaders: null,
              cdpAddress: null,
              browser_config: form.getValues("browser_config"),
            }}
          />
        </div>
      </TaskCreateLayout>
    );
  }

  if (sampleCases.includes(template as SampleCase)) {
    return (
      <TaskCreateLayout formControl={form.control}>
        <div className="space-y-4">
          <header>
            <h1 className="text-3xl">Create New Task</h1>
          </header>
          <CreateNewTaskForm
            key={template}
            initialValues={getSampleForInitialFormValues(template as SampleCase)}
          />
        </div>
      </TaskCreateLayout>
    );
  }

  if (isFetching) {
    return (
      <TaskCreateLayout formControl={form.control}>
        <div className="space-y-4">
          <header>
            <h1 className="text-3xl">Edit Task Template</h1>
          </header>
          <Skeleton className="h-96" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </TaskCreateLayout>
    );
  }

  const navigationPayload = data?.workflow_definition?.parameters?.find(
    (parameter: WorkflowParameter) => parameter.key === "navigation_payload",
  )?.default_value;

  const dataSchema = data?.workflow_definition?.blocks?.[0]?.data_schema;
  const errorCodeMapping = data?.workflow_definition?.blocks?.[0]?.error_code_mapping;
  const maxStepsOverride = data?.workflow_definition?.blocks?.[0]?.max_steps_per_run;

  return (
    <TaskCreateLayout formControl={form.control}>
      <div className="space-y-4">
        <header>
          <h1 className="text-3xl">Edit Task Template</h1>
        </header>
        <SavedTaskForm
          initialValues={{
            title: data.title,
            description: data.description,
            webhookCallbackUrl: data.webhook_callback_url,
            proxyLocation: data.proxy_location,
            url: data.workflow_definition.blocks[0].url,
            navigationGoal: data.workflow_definition.blocks[0].navigation_goal,
            dataExtractionGoal:
              data.workflow_definition.blocks[0].data_extraction_goal,
            extractedInformationSchema: JSON.stringify(dataSchema, null, 2),
            navigationPayload:
              typeof navigationPayload === "string"
                ? navigationPayload
                : JSON.stringify(navigationPayload, null, 2),
            maxStepsOverride,
            totpIdentifier: data.workflow_definition.blocks[0].totp_identifier,
            errorCodeMapping: JSON.stringify(errorCodeMapping, null, 2),
            includeActionHistoryInVerification:
              data.workflow_definition.blocks[0]
                .include_action_history_in_verification,
            maxScreenshotScrolls: data.max_screenshot_scrolls,
            extraHttpHeaders: data.extra_http_headers
              ? JSON.stringify(data.extra_http_headers)
              : null,
            cdpAddress: null,
            browser_config: form.getValues("browser_config"),
          }}
        />
      </div>
    </TaskCreateLayout>
  );
}

export { TaskCreateWithSidebar };