# 2.1 创建AdsPower服务类和服务状态检查
import asyncio
import aiohttp
import subprocess
import tempfile
import random
import structlog
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
from playwright.async_api import Playwright, BrowserContext, Page
from skyvern.forge.sdk.schemas.browser import BrowserConfig, BrowserType, AdsPowerStatus

LOG = structlog.get_logger()


class AdsPowerService:
    """
    AdsPower API服务类，负责与AdsPower客户端进行交互
    提供浏览器状态检查、启动、停止等功能
    """

    def __init__(self, base_url: str = "http://localhost:50325"):
        self.base_url = base_url
        self.timeout = 30

    async def check_status(self) -> AdsPowerStatus:
        """
        检查AdsPower服务状态并获取可用浏览器列表

        Returns:
            AdsPowerStatus: 包含服务状态和浏览器列表的对象
        """
        try:
            # 检查AdsPower服务是否运行
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                async with session.get(f"{self.base_url}/api/v1/status") as resp:
                    if resp.status != 200:
                        return AdsPowerStatus(
                            available=False,
                            message=f"AdsPower服务响应异常: HTTP {resp.status}",
                            browsers=[]
                        )

                # 获取浏览器列表
                async with session.get(f"{self.base_url}/api/v1/user/list") as resp:
                    browsers_data = await resp.json()

                    if browsers_data.get("code") != 0:
                        return AdsPowerStatus(
                            available=True,
                            message="AdsPower连接正常，但获取浏览器列表失败",
                            browsers=[]
                        )

                    # 转换浏览器数据格式
                    browsers = []
                    for browser_data in browsers_data.get("data", {}).get("list", []):
                        browsers.append(AdsPowerBrowserInfo(
                            user_id=browser_data.get("user_id", ""),
                            name=browser_data.get("name", ""),
                            serial_number=browser_data.get("serial_number", ""),
                            remark=browser_data.get("remark"),
                            group_id=browser_data.get("group_id"),
                            status=browser_data.get("status", "Unknown")
                        ))

                    return AdsPowerStatus(
                        available=True,
                        message=f"AdsPower连接正常，找到 {len(browsers)} 个浏览器",
                        browsers=browsers
                    )

        except asyncio.TimeoutError:
            return AdsPowerStatus(
                available=False,
                message="AdsPower连接超时，请检查客户端是否启动",
                browsers=[]
            )
        except Exception as e:
            LOG.error("检查AdsPower状态失败", error=str(e))
            return AdsPowerStatus(
                available=False,
                message=f"AdsPower客户端未启动或网络异常: {str(e)}",
                browsers=[]
            )

    async def start_browser(self, user_id: str) -> Dict[str, Any]:
        """
        启动指定的AdsPower浏览器

        Args:
            user_id: AdsPower浏览器用户ID

        Returns:
            Dict包含启动结果和连接信息
        """
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                params = {"userId": user_id}
                async with session.get(f"{self.base_url}/api/v1/browser/start", params=params) as resp:
                    result = await resp.json()

                    if result.get("code") != 0:
                        raise Exception(f"AdsPower启动浏览器失败: {result.get('msg', '未知错误')}")

                    # 返回连接信息
                    ws_data = result.get("data", {}).get("ws", {})
                    return {
                        "success": True,
                        "selenium_url": f"http://{ws_data.get('selenium', '')}",
                        "puppeteer_url": f"ws://{ws_data.get('puppeteer', '')}",
                        "user_id": user_id
                    }

        except Exception as e:
            LOG.error("启动AdsPower浏览器失败", user_id=user_id, error=str(e))
            raise Exception(f"启动AdsPower浏览器失败: {str(e)}")

    async def stop_browser(self, user_id: str) -> bool:
        """
        停止指定的AdsPower浏览器

        Args:
            user_id: AdsPower浏览器用户ID

        Returns:
            bool: 是否成功停止
        """
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
                params = {"userId": user_id}
                async with session.get(f"{self.base_url}/api/v1/browser/stop", params=params) as resp:
                    result = await resp.json()
                    return result.get("code") == 0
        except Exception as e:
            LOG.error("停止AdsPower浏览器失败", user_id=user_id, error=str(e))
            return False