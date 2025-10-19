# 性能优化和错误处理完善
import asyncio
import aiohttp
import subprocess
import tempfile
import random
import structlog
import time
from pathlib import Path
from typing import Dict, Any, Optional, Set
from playwright.async_api import Playwright, BrowserContext
from skyvern.forge.sdk.schemas.browser import BrowserConfig, BrowserType

LOG = structlog.get_logger()

# 全局端口管理器，避免端口冲突
class PortManager:
    """
    端口管理器，确保CDP端口不会冲突
    """
    _used_ports: Set[int] = set()
    _port_range = range(9222, 9999)
    _lock = asyncio.Lock()

    @classmethod
    async def get_available_port(cls) -> int:
        """获取可用的CDP端口"""
        async with cls._lock:
            # 尝试最多100个端口
            for _ in range(100):
                port = random.choice(list(cls._port_range))
                if port not in cls._used_ports and not await cls._is_port_in_use(port):
                    cls._used_ports.add(port)
                    return port

            raise Exception("无法找到可用的CDP端口")

    @classmethod
    async def release_port(cls, port: int) -> None:
        """释放端口"""
        async with cls._lock:
            cls._used_ports.discard(port)

    @classmethod
    async def _is_port_in_use(cls, port: int) -> bool:
        """检查端口是否被使用"""
        try:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection('localhost', port),
                timeout=1
            )
            writer.close()
            await writer.wait_closed()
            return True
        except (OSError, asyncio.TimeoutError):
            return False


class ChromeProcessManager:
    """
    Chrome进程管理器，优化进程启动和监控
    """
    def __init__(self):
        self._processes: Dict[int, subprocess.Popen] = {}
        self._temp_dirs: Dict[int, str] = {}
        self._monitor_tasks: Dict[int, asyncio.Task] = {}

    async def start_chrome(self, chrome_path: str, args: list, cdp_port: int) -> subprocess.Popen:
        """启动Chrome进程并添加监控"""
        try:
            # 使用更高效的启动参数
            optimized_args = [
                f"--remote-debugging-port={cdp_port}",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-infobars",
                "--disable-extensions",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-gpu",  # 减少GPU资源使用
                "--disable-software-rasterizer",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
                "--disable-features=TranslateUI",
                "--disable-ipc-flooding-protection",
                "--password-store=basic",  # 避免密码管理器弹窗
                "--use-mock-keychain",  # macOS优化
            ]

            # 添加用户自定义参数
            optimized_args.extend(args)

            # 创建临时用户数据目录
            temp_dir = tempfile.mkdtemp(prefix=f"skyvern_chrome_{cdp_port}_")
            optimized_args.append(f"--user-data-dir={temp_dir}")

            LOG.info("启动优化后的Chrome进程",
                     chrome_path=chrome_path,
                     cdp_port=cdp_port,
                     temp_dir=temp_dir,
                     args_count=len(optimized_args))

            # 启动进程
            process = subprocess.Popen(
                [chrome_path] + optimized_args,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                # Windows优化
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if hasattr(subprocess, 'CREATE_NEW_PROCESS_GROUP') else 0,
                # 设置较低优先级
                # preexec_fn=lambda: os.nice(5) if hasattr(os, 'nice') else None
            )

            # 存储进程信息
            self._processes[cdp_port] = process
            self._temp_dirs[cdp_port] = temp_dir

            # 启动进程监控
            self._monitor_tasks[cdp_port] = asyncio.create_task(
                self._monitor_chrome_process(cdp_port, process)
            )

            return process

        except Exception as e:
            LOG.error("启动Chrome进程失败", error=str(e), cdp_port=cdp_port)
            await self._cleanup_chrome_resources(cdp_port)
            raise

    async def _monitor_chrome_process(self, cdp_port: int, process: subprocess.Popen) -> None:
        """监控Chrome进程状态"""
        try:
            while True:
                if process.poll() is not None:
                    # 进程已结束
                    LOG.warning("Chrome进程意外结束",
                               cdp_port=cdp_port,
                               return_code=process.returncode)
                    break

                # 每5秒检查一次
                await asyncio.sleep(5)

        except asyncio.CancelledError:
            LOG.info("Chrome进程监控任务被取消", cdp_port=cdp_port)
        except Exception as e:
            LOG.error("Chrome进程监控出错", error=str(e), cdp_port=cdp_port)

    async def stop_chrome(self, cdp_port: int) -> bool:
        """优雅地停止Chrome进程"""
        try:
            process = self._processes.get(cdp_port)
            if not process:
                return True

            LOG.info("停止Chrome进程", cdp_port=cdp_port)

            # 取消监控任务
            monitor_task = self._monitor_tasks.get(cdp_port)
            if monitor_task and not monitor_task.done():
                monitor_task.cancel()
                try:
                    await monitor_task
                except asyncio.CancelledError:
                    pass

            # 优雅终止进程
            if process.poll() is None:
                process.terminate()

                # 等待进程结束（最多10秒）
                try:
                    await asyncio.wait_for(
                        asyncio.get_event_loop().run_in_executor(None, process.wait),
                        timeout=10
                    )
                except asyncio.TimeoutError:
                    LOG.warning("Chrome进程终止超时，强制杀死", cdp_port=cdp_port)
                    process.kill()
                    await asyncio.get_event_loop().run_in_executor(None, process.wait)

            # 清理资源
            await self._cleanup_chrome_resources(cdp_port)

            LOG.info("Chrome进程已停止", cdp_port=cdp_port)
            return True

        except Exception as e:
            LOG.error("停止Chrome进程失败", error=str(e), cdp_port=cdp_port)
            return False

    async def _cleanup_chrome_resources(self, cdp_port: int) -> None:
        """清理Chrome相关资源"""
        try:
            # 清理临时目录
            temp_dir = self._temp_dirs.get(cdp_port)
            if temp_dir and Path(temp_dir).exists():
                import shutil
                await asyncio.get_event_loop().run_in_executor(
                    None, shutil.rmtree, temp_dir, True
                )
                LOG.debug("清理Chrome临时目录", cdp_port=cdp_port, temp_dir=temp_dir)

            # 释放端口
            await PortManager.release_port(cdp_port)

            # 清理内部记录
            self._processes.pop(cdp_port, None)
            self._temp_dirs.pop(cdp_port, None)
            self._monitor_tasks.pop(cdp_port, None)

        except Exception as e:
            LOG.error("清理Chrome资源失败", error=str(e), cdp_port=cdp_port)

    async def cleanup_all(self) -> None:
        """清理所有管理的Chrome进程"""
        LOG.info("开始清理所有Chrome进程", process_count=len(self._processes))

        cleanup_tasks = []
        for cdp_port in list(self._processes.keys()):
            cleanup_tasks.append(self.stop_chrome(cdp_port))

        if cleanup_tasks:
            await asyncio.gather(*cleanup_tasks, return_exceptions=True)

        LOG.info("所有Chrome进程清理完成")


class CDPConnectionManager:
    """
    CDP连接管理器，优化Playwright连接
    """
    def __init__(self):
        self._connection_pool: Dict[str, Any] = {}
        self._connection_timeouts: Dict[str, float] = {}
        self._max_connection_age = 300  # 5分钟

    async def connect_with_retry(self, playwright: Playwright, cdp_url: str, max_retries: int = 3) -> Any:
        """带重试的CDP连接"""

        # 检查是否已有有效连接
        if cdp_url in self._connection_pool:
            connection_time = self._connection_timeouts.get(cdp_url, 0)
            if time.time() - connection_time < self._max_connection_age:
                LOG.debug("使用现有CDP连接", cdp_url=cdp_url)
                return self._connection_pool[cdp_url]
            else:
                # 连接已过期，清理
                LOG.debug("CDP连接已过期，重新连接", cdp_url=cdp_url)
                await self.disconnect(cdp_url)

        # 尝试建立新连接
        for attempt in range(max_retries):
            try:
                LOG.info("建立CDP连接", cdp_url=cdp_url, attempt=attempt + 1)

                # 使用更长的超时时间
                browser = await asyncio.wait_for(
                    playwright.chromium.connect_over_cdp(cdp_url),
                    timeout=30
                )

                # 存储连接信息
                self._connection_pool[cdp_url] = browser
                self._connection_timeouts[cdp_url] = time.time()

                LOG.info("CDP连接建立成功", cdp_url=cdp_url)
                return browser

            except asyncio.TimeoutError:
                LOG.warning("CDP连接超时", cdp_url=cdp_url, attempt=attempt + 1)
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # 指数退避
                else:
                    raise
            except Exception as e:
                LOG.error("CDP连接失败", cdp_url=cdp_url, attempt=attempt + 1, error=str(e))
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise

        raise Exception(f"CDP连接失败，已重试{max_retries}次")

    async def disconnect(self, cdp_url: str) -> None:
        """断开CDP连接"""
        browser = self._connection_pool.pop(cdp_url, None)
        self._connection_timeouts.pop(cdp_url, None)

        if browser:
            try:
                await browser.close()
                LOG.debug("CDP连接已关闭", cdp_url=cdp_url)
            except Exception as e:
                LOG.error("关闭CDP连接失败", cdp_url=cdp_url, error=str(e))

    async def disconnect_all(self) -> None:
        """断开所有CDP连接"""
        LOG.info("开始断开所有CDP连接", connection_count=len(self._connection_pool))

        disconnect_tasks = []
        for cdp_url in list(self._connection_pool.keys()):
            disconnect_tasks.append(self.disconnect(cdp_url))

        if disconnect_tasks:
            await asyncio.gather(*disconnect_tasks, return_exceptions=True)

        LOG.info("所有CDP连接已断开")


# 全局管理器实例
chrome_manager = ChromeProcessManager()
cdp_manager = CDPConnectionManager()


async def optimized_create_local_custom_browser(
    playwright: Playwright,
    proxy_location: ProxyLocation | None = None,
    extra_http_headers: dict[str, str] | None = None,
    **kwargs: dict,
) -> tuple[BrowserContext, BrowserArtifacts, BrowserCleanupFunc]:
    """
    优化的本地自定义Chrome浏览器创建函数
    """
    browser_config: BrowserConfig = kwargs.get("browser_config")
    if not browser_config or not browser_config.chrome_path:
        raise ValueError("本地自定义Chrome模式需要提供有效的browser_config.chrome_path")

    chrome_path = Path(browser_config.chrome_path)
    if not chrome_path.exists():
        raise FileNotFoundError(f"Chrome路径不存在: {chrome_path}")

    # 获取可用端口
    cdp_port = await PortManager.get_available_port()

    try:
        # 启动优化的Chrome进程
        process = await chrome_manager.start_chrome(
            str(chrome_path),
            browser_config.chrome_args or [],
            cdp_port
        )

        cdp_url = f"http://localhost:{cdp_port}"

        # 等待Chrome启动完成
        if not await _wait_for_chrome_ready_optimized(cdp_url, timeout=30):
            await chrome_manager.stop_chrome(cdp_port)
            raise Exception(f"Chrome启动超时，CDP端口: {cdp_port}")

        # 建立优化的CDP连接
        browser = await cdp_manager.connect_with_retry(playwright, cdp_url)

        # 创建浏览器上下文
        browser_context = await browser.new_context(
            extra_http_headers=extra_http_headers,
        )

        # 设置浏览器artifacts
        browser_artifacts = BrowserContextFactory.build_browser_artifacts(**kwargs)

        # 设置控制台日志记录
        set_browser_console_log(browser_context, browser_artifacts)

        # 设置下载监听器
        set_download_file_listener(browser_context, **kwargs)

        # 定义清理函数
        def cleanup_func():
            """清理本地Chrome浏览器资源"""
            asyncio.create_task(chrome_manager.stop_chrome(cdp_port))

        LOG.info("本地Chrome浏览器创建成功(优化版)", cdp_port=cdp_port, cdp_url=cdp_url)
        return browser_context, browser_artifacts, cleanup_func

    except Exception as e:
        LOG.error("创建本地Chrome浏览器失败(优化版)", error=str(e))
        await chrome_manager.stop_chrome(cdp_port)
        raise


async def _wait_for_chrome_ready_optimized(cdp_url: str, timeout: int = 30) -> bool:
    """
    优化的Chrome CDP接口等待函数
    """
    start_time = time.time()
    retry_delay = 0.5  # 初始重试延迟
    max_retry_delay = 2.0

    while time.time() - start_time < timeout:
        try:
            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=2),
                connector=aiohttp.TCPConnector(limit=1)  # 限制连接数
            ) as session:
                async with session.get(f"{cdp_url}/json/version") as resp:
                    if resp.status == 200:
                        LOG.debug("Chrome CDP接口就绪(优化版)", cdp_url=cdp_url)
                        return True
        except Exception as e:
            # 指数退避重试
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 1.5, max_retry_delay)

    LOG.error("Chrome CDP接口连接超时(优化版)", cdp_url=cdp_url, timeout=timeout)
    return False


# 清理函数，应用退出时调用
async def cleanup_all_browser_resources() -> None:
    """清理所有浏览器相关资源"""
    LOG.info("开始清理所有浏览器资源")

    cleanup_tasks = [
        chrome_manager.cleanup_all(),
        cdp_manager.disconnect_all()
    ]

    await asyncio.gather(*cleanup_tasks, return_exceptions=True)

    LOG.info("所有浏览器资源清理完成")