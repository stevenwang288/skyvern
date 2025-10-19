# ========================= 扩展Skyvern浏览器集成方案 =========================
# 新增浏览器配置Schema，支持多种浏览器类型
# ==========================================================================

from enum import StrEnum
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class BrowserType(StrEnum):
    """
    浏览器类型枚举
    - skyvern_default: Skyvern默认浏览器，使用现有的chromium-headless/headful模式
    - local_custom: 本地自定义Chrome，允许用户指定Chrome路径和参数
    - adspower: AdsPower防关联浏览器，企业级反检测解决方案
    """
    SKYVERN_DEFAULT = "skyvern_default"
    LOCAL_CUSTOM = "local_custom"
    ADSPOWER = "adspower"


class BrowserConfig(BaseModel):
    """
    浏览器配置模型，支持多种浏览器类型的统一配置
    """
    type: BrowserType = Field(
        default=BrowserType.SKYVERN_DEFAULT,
        description="浏览器类型，决定使用哪种浏览器创建策略"
    )
    chrome_path: Optional[str] = Field(
        default=None,
        description="本地Chrome执行文件路径，仅在type为local_custom时使用"
    )
    chrome_args: Optional[List[str]] = Field(
        default=None,
        description="Chrome启动参数列表，可用于自定义浏览器行为"
    )
    adspower_user_id: Optional[str] = Field(
        default=None,
        description="AdsPower浏览器用户ID，仅在type为adspower时使用"
    )
    adspower_group_id: Optional[str] = Field(
        default=None,
        description="AdsPower浏览器分组ID，可选"
    )


class AdsPowerBrowserInfo(BaseModel):
    """AdsPower浏览器信息模型"""
    user_id: str = Field(description="浏览器用户ID")
    name: str = Field(description="浏览器名称")
    serial_number: str = Field(description="浏览器序列号")
    remark: Optional[str] = Field(default=None, description="备注信息")
    group_id: Optional[str] = Field(default=None, description="分组ID")
    status: str = Field(description="浏览器状态：Active/Inactive")


class AdsPowerStatus(BaseModel):
    """AdsPower服务状态模型"""
    available: bool = Field(description="AdsPower服务是否可用")
    message: str = Field(description="状态信息")
    browsers: List[AdsPowerBrowserInfo] = Field(default=[], description="可用浏览器列表")