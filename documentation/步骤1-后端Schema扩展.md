# 步骤1: 后端Schema扩展

## 概述
建立多浏览器支持的数据结构基础，定义浏览器类型枚举和配置模型。

## 目标文件
`skyvern/forge/sdk/schemas/browser.py`

## 实施内容

### 1.1 浏览器类型枚举定义
```python
from enum import StrEnum

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
```

### 1.2 统一浏览器配置模型
```python
from pydantic import BaseModel, Field
from typing import Optional, List

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
```

### 1.3 AdsPower专用模型
```python
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
```

### 1.4 任务模型集成
修改 `skyvern/forge/sdk/schemas/tasks.py`，在TaskBase类中添加：
```python
class TaskBase(BaseModel):
    # ... 现有字段保持不变 ...

    browser_config: Optional[BrowserConfig] = Field(
        default=None,
        description="浏览器配置，指定任务使用的浏览器类型和相关参数"
    )
```

## 技术要点

1. **类型安全**: 使用StrEnum确保枚举值的一致性
2. **灵活配置**: Optional字段支持不同浏览器类型的特定需求
3. **验证机制**: Pydantic自动进行数据验证
4. **向后兼容**: 默认使用skyvern_default，不影响现有功能

## 验证方法

1. 导入模型无报错
2. 能正确创建BrowserConfig实例
3. 序列化和反序列化正常
4. 与现有Task模型集成无冲突

## 下一步
完成Schema定义后，进入步骤2：浏览器工厂模式扩展