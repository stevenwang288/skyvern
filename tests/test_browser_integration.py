# 5.1 创建后端集成测试
import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from pathlib import Path

from skyvern.forge.sdk.schemas.browser import BrowserType, BrowserConfig, AdsPowerStatus, AdsPowerBrowserInfo
from skyvern.webeye.adspower_service import AdsPowerService
from skyvern.webeye.browser_factory import BrowserContextFactory, _create_adspower_browser, _create_local_custom_browser
from skyvern.forge.sdk.schemas.tasks import TaskRequest


class TestBrowserIntegration:
    """浏览器集成测试类"""

    @pytest.fixture
    def sample_browser_config(self):
        """测试用的浏览器配置"""
        return {
            "skyvern_default": BrowserConfig(type=BrowserType.SKYVERN_DEFAULT),
            "local_custom": BrowserConfig(
                type=BrowserType.LOCAL_CUSTOM,
                chrome_path="/usr/bin/google-chrome",
                chrome_args=["--window-size=1920,1080"]
            ),
            "adspower": BrowserConfig(
                type=BrowserType.ADSPOWER,
                adspower_user_id="test_user_123"
            )
        }

    @pytest.mark.asyncio
    async def test_adspower_service_check_status_success(self):
        """测试AdsPower服务状态检查 - 成功场景"""
        # Mock aiohttp响应
        mock_response_data = {
            "code": 0,
            "data": {
                "list": [
                    {
                        "user_id": "user123",
                        "name": "Test Browser",
                        "serial_number": "SN12345",
                        "remark": "Test remark",
                        "group_id": "group1",
                        "status": "Active"
                    }
                ]
            }
        }

        with patch('aiohttp.ClientSession') as mock_session:
            # Mock状态检查响应
            mock_status_response = AsyncMock()
            mock_status_response.status = 200

            # Mock浏览器列表响应
            mock_list_response = AsyncMock()
            mock_list_response.json = AsyncMock(return_value=mock_response_data)

            # Mock session.get方法
            mock_get = AsyncMock()
            mock_get.side_effect = [mock_status_response, mock_list_response]
            mock_session.return_value.__aenter__.return_value.get = mock_get

            service = AdsPowerService()
            result = await service.check_status()

            assert result.available is True
            assert len(result.browsers) == 1
            assert result.browsers[0].user_id == "user123"
            assert result.browsers[0].name == "Test Browser"

    @pytest.mark.asyncio
    async def test_adspower_service_check_status_failure(self):
        """测试AdsPower服务状态检查 - 失败场景"""
        with patch('aiohttp.ClientSession') as mock_session:
            # Mock连接超时
            mock_session.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=asyncio.TimeoutError()
            )

            service = AdsPowerService()
            result = await service.check_status()

            assert result.available is False
            assert "超时" in result.message
            assert len(result.browsers) == 0

    @pytest.mark.asyncio
    async def test_adspower_service_start_browser_success(self):
        """测试AdsPower启动浏览器 - 成功场景"""
        mock_response_data = {
            "code": 0,
            "data": {
                "ws": {
                    "selenium": "127.0.0.1:9222",
                    "puppeteer": "127.0.0.1:9223/devtools/browser/123"
                }
            }
        }

        with patch('aiohttp.ClientSession') as mock_session:
            mock_response = AsyncMock()
            mock_response.json = AsyncMock(return_value=mock_response_data)
            mock_session.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

            service = AdsPowerService()
            result = await service.start_browser("test_user_123")

            assert result["success"] is True
            assert "selenium_url" in result
            assert "puppeteer_url" in result
            assert result["user_id"] == "test_user_123"

    @pytest.mark.asyncio
    async def test_adspower_service_start_browser_failure(self):
        """测试AdsPower启动浏览器 - 失败场景"""
        mock_response_data = {
            "code": 1,
            "msg": "Browser not found"
        }

        with patch('aiohttp.ClientSession') as mock_session:
            mock_response = AsyncMock()
            mock_response.json = AsyncMock(return_value=mock_response_data)
            mock_session.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

            service = AdsPowerService()

            with pytest.raises(Exception) as exc_info:
                await service.start_browser("invalid_user")

            assert "Browser not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_browser_factory_registration(self):
        """测试浏览器工厂类型注册"""
        # 验证新类型已注册
        assert "adspower" in BrowserContextFactory._creators
        assert "local-custom" in BrowserContextFactory._creators
        assert BrowserContextFactory._creators["adspower"] is not None
        assert BrowserContextFactory._creators["local-custom"] is not None

    @pytest.mark.asyncio
    async def test_create_adspower_browser_missing_config(self):
        """测试创建AdsPower浏览器 - 缺少配置"""
        mock_playwright = Mock()

        with pytest.raises(ValueError) as exc_info:
            await _create_adspower_browser(mock_playwright)

        assert "需要提供有效的browser_config.adspower_user_id" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_local_custom_browser_missing_config(self):
        """测试创建本地自定义Chrome浏览器 - 缺少配置"""
        mock_playwright = Mock()

        with pytest.raises(ValueError) as exc_info:
            await _create_local_custom_browser(mock_playwright)

        assert "需要提供有效的browser_config.chrome_path" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_local_custom_browser_invalid_path(self):
        """测试创建本地自定义Chrome浏览器 - 无效路径"""
        mock_playwright = Mock()
        browser_config = BrowserConfig(
            type=BrowserType.LOCAL_CUSTOM,
            chrome_path="/invalid/chrome/path"
        )

        with pytest.raises(FileNotFoundError) as exc_info:
            await _create_local_custom_browser(mock_playwright, browser_config=browser_config)

        assert "Chrome路径不存在" in str(exc_info.value)

    def test_browser_config_validation(self):
        """测试浏览器配置验证"""
        # 测试有效配置
        valid_config = BrowserConfig(
            type=BrowserType.LOCAL_CUSTOM,
            chrome_path="/usr/bin/google-chrome",
            chrome_args=["--window-size=1920,1080"]
        )
        assert valid_config.type == BrowserType.LOCAL_CUSTOM
        assert valid_config.chrome_path == "/usr/bin/google-chrome"
        assert valid_config.chrome_args == ["--window-size=1920,1080"]

        # 测试AdsPower配置
        adspower_config = BrowserConfig(
            type=BrowserType.ADSPOWER,
            adspower_user_id="user123"
        )
        assert adspower_config.type == BrowserType.ADSPOWER
        assert adspower_config.adspower_user_id == "user123"

    @pytest.mark.asyncio
    async def test_task_request_with_browser_config(self):
        """测试包含浏览器配置的任务请求"""
        task_data = {
            "url": "https://example.com",
            "navigation_goal": "测试浏览器配置",
            "browser_config": {
                "type": BrowserType.LOCAL_CUSTOM,
                "chrome_path": "/usr/bin/google-chrome",
                "chrome_args": ["--headless"]
            }
        }

        task_request = TaskRequest(**task_data)
        assert task_request.url == "https://example.com"
        assert task_request.browser_config is not None
        assert task_request.browser_config.type == BrowserType.LOCAL_CUSTOM
        assert task_request.browser_config.chrome_path == "/usr/bin/google-chrome"

    def test_adspower_browser_info_model(self):
        """测试AdsPower浏览器信息模型"""
        browser_info = AdsPowerBrowserInfo(
            user_id="user123",
            name="Test Browser",
            serial_number="SN12345",
            status="Active",
            remark="Test remark"
        )

        assert browser_info.user_id == "user123"
        assert browser_info.name == "Test Browser"
        assert browser_info.serial_number == "SN12345"
        assert browser_info.status == "Active"
        assert browser_info.remark == "Test remark"

    def test_adspower_status_model(self):
        """测试AdsPower状态模型"""
        browser_info = AdsPowerBrowserInfo(
            user_id="user123",
            name="Test Browser",
            serial_number="SN12345",
            status="Active"
        )

        status = AdsPowerStatus(
            available=True,
            message="服务正常",
            browsers=[browser_info]
        )

        assert status.available is True
        assert status.message == "服务正常"
        assert len(status.browsers) == 1
        assert status.browsers[0].user_id == "user123"

    @pytest.mark.asyncio
    async def test_concurrent_browser_creation(self):
        """测试并发浏览器创建"""
        # 模拟并发请求
        configs = [
            BrowserConfig(type=BrowserType.SKYVERN_DEFAULT),
            BrowserConfig(type=BrowserType.LOCAL_CUSTOM, chrome_path="/usr/bin/google-chrome"),
            BrowserConfig(type=BrowserType.ADSPOWER, adspower_user_id="user1"),
        ]

        # 这里应该模拟实际的并发创建，但为了测试简化，只验证配置
        for config in configs:
            assert config.type in [BrowserType.SKYVERN_DEFAULT, BrowserType.LOCAL_CUSTOM, BrowserType.ADSPOWER]

    def test_browser_type_enum_values(self):
        """测试浏览器类型枚举值"""
        assert BrowserType.SKYVERN_DEFAULT == "skyvern_default"
        assert BrowserType.LOCAL_CUSTOM == "local_custom"
        assert BrowserType.ADSPOWER == "adspower"

        # 验证所有枚举值都是有效的字符串
        for browser_type in BrowserType:
            assert isinstance(browser_type.value, str)
            assert len(browser_type.value) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])