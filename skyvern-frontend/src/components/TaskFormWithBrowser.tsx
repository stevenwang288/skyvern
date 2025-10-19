// 9. 任务创建表单集成示例
// 在任务创建表单中使用BrowserSelector组件：

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form } from './ui/form';
import { BrowserSelector } from '../components/BrowserSelector';
import { BrowserType } from '../api/browser-types';

// 在表单schema中添加browser_config字段：
const taskFormSchema = z.object({
  // ... 现有字段 ...
  title: z.string().optional(),
  url: z.string().url(),
  navigation_goal: z.string().optional(),
  data_extraction_goal: z.string().optional(),
  navigation_payload: z.record(z.any()).optional(),
  proxy_location: z.string().optional(),
  // 添加浏览器配置
  browser_config: z.object({
    type: z.nativeEnum(BrowserType).default(BrowserType.SkyvernDefault),
    chrome_path: z.string().optional(),
    chrome_args: z.array(z.string()).optional(),
    adspower_user_id: z.string().optional(),
    adspower_group_id: z.string().optional(),
  }).optional(),
});

interface TaskFormWithBrowserProps {
  onSubmit: (data: any) => void;
  defaultValues?: any;
}

export function TaskFormWithBrowser({ onSubmit, defaultValues }: TaskFormWithBrowserProps) {
  const form = useForm({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      ...defaultValues,
      browser_config: {
        type: BrowserType.SkyvernDefault
      }
    }
  });

  const handleSubmit = (data: any) => {
    // 清理空的浏览器配置
    if (data.browser_config) {
      const { type, chrome_path, chrome_args, adspower_user_id } = data.browser_config;

      // 根据不同类型清理不需要的字段
      switch (type) {
        case BrowserType.SkyvernDefault:
          data.browser_config = { type };
          break;
        case BrowserType.LocalCustom:
          data.browser_config = {
            type,
            chrome_path: chrome_path || undefined,
            chrome_args: chrome_args?.length ? chrome_args : undefined
          };
          break;
        case BrowserType.AdsPower:
          data.browser_config = {
            type,
            adspower_user_id: adspower_user_id || undefined
          };
          break;
      }
    }

    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* 其他表单字段 */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">基本配置</h2>

          {/* 这里放置现有的表单字段 */}
          <div>
            <label className="block text-sm font-medium mb-2">任务标题</label>
            <input
              {...form.register("title")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入任务标题"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">目标URL *</label>
            <input
              {...form.register("url")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">导航目标</label>
            <textarea
              {...form.register("navigation_goal")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="描述你的导航目标..."
              rows={3}
            />
          </div>
        </div>

        {/* 浏览器选择器 */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">浏览器配置</h2>
          <BrowserSelector control={form.control} name="browser_config" />
        </div>

        {/* 提交按钮 */}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          创建任务
        </button>
      </form>
    </Form>
  );
}

// 使用示例
export function CreateTaskPage() {
  const handleSubmit = async (data: any) => {
    try {
      console.log('提交任务数据:', data);
      // 这里调用API创建任务
      // await createTask(data);
      alert('任务创建成功！');
    } catch (error) {
      console.error('创建任务失败:', error);
      alert('任务创建失败，请重试');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">创建新任务</h1>
      <TaskFormWithBrowser onSubmit={handleSubmit} />
    </div>
  );
}