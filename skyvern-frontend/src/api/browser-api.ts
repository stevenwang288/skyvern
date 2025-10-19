// 7. 前端API客户端 (skyvern-frontend/src/api/browser-api.ts)

import { AdsPowerStatus } from "./browser-types";
import { getClient } from "./AxiosClient";

export const getAdsPowerStatus = async (credentialGetter: () => Promise<string>): Promise<AdsPowerStatus> => {
  const client = await getClient(credentialGetter);
  const response = await client.get<AdsPowerStatus>('/browser/adspower/status');
  return response.data;
};

export const validateChromePath = async (chromePath: string, credentialGetter: () => Promise<string>): Promise<{valid: boolean; message: string; path?: string}> => {
  const client = await getClient(credentialGetter);
  const response = await client.post('/browser/validate-chrome-path', { chrome_path: chromePath });
  return response.data;
};