# 步骤4: API路由层开发

## 概述
创建新的API路由文件，提供浏览器状态检查和路径验证接口，为前端提供浏览器配置验证能力。

## 目标文件
`skyvern/forge/sdk/routes/browser.py` (新建)

## 实施内容

### 4.1 创建浏览器路由文件
```python
from fastapi import APIRouter, HTTPException, Depends
from pathlib import Path
import structlog

from skyvern.forge.sdk.schemas.browser import AdsPowerStatus, BrowserConfig
from skyvern.webeye.browser_factory import AdsPowerService
from skyvern.forge.sdk.api.models import validate_api_key

# 创建路由器实例
router = APIRouter()
LOG = structlog.get_logger()
```

### 4.2 AdsPower状态检查接口
```python
@router.get("/adspower/status", response_model=AdsPowerStatus)
async def get_adspower_status(
    api_key: str = Depends(validate_api_key)
) -> AdsPowerStatus:
    """
    获取AdsPower服务状态和可用浏览器列表

    检查AdsPower客户端是否运行，并返回可用的浏览器配置列表
    用于前端显示可选的防关联浏览器

    Returns:
        AdsPowerStatus: 包含服务状态和浏览器列表
    """
    try:
        adspower_service = AdsPowerService()
        status = await adspower_service.check_status()
        return status
    except Exception as e:
        LOG.error("获取AdsPower状态失败", error=str(e))
        raise HTTPException(status_code=500, detail=f"获取AdsPower状态失败: {str(e)}")
```

### 4.3 Chrome路径验证接口
```python
@router.post("/validate-chrome-path")
async def validate_chrome_path(
    chrome_path: str,
    api_key: str = Depends(validate_api_key)
) -> dict:
    """
    验证Chrome路径是否有效

    Args:
        chrome_path: Chrome执行文件路径

    Returns:
        dict: 包含验证结果的字典
    """
    try:
        path = Path(chrome_path)
        is_valid = path.exists() and path.is_file()

        # 进一步验证文件类型（可选）
        if is_valid:
            # Windows系统检查.exe扩展名
            if path.suffix.lower() == '.exe' or not path.suffix:
                # 检查文件大小是否合理（Chrome通常大于100MB）
                file_size_mb = path.stat().st_size / (1024 * 1024)
                if file_size_mb < 10:  # 小于10MB可能不是有效的Chrome
                    is_valid = False
                    message = "文件大小异常，可能不是有效的Chrome执行文件"
                else:
                    message = "Chrome路径有效"
            else:
                is_valid = False
                message = "文件扩展名不匹配（期望.exe或无扩展名）"
        else:
            message = "Chrome路径无效或文件不存在"

        return {
            "valid": is_valid,
            "message": message,
            "path": str(path.absolute()) if is_valid else None,
            "file_size_mb": round(path.stat().st_size / (1024 * 1024), 2) if is_valid else None
        }
    except Exception as e:
        LOG.error("Chrome路径验证失败", error=str(e), chrome_path=chrome_path)
        return {
            "valid": False,
            "message": f"路径验证失败: {str(e)}",
            "path": None
        }
```

### 4.4 增强的路径验证功能
```python
@router.post("/validate-chrome-path/detailed")
async def validate_chrome_path_detailed(
    chrome_path: str,
    api_key: str = Depends(validate_api_key)
) -> dict:
    """
    详细的Chrome路径验证，包含更多检查项

    Args:
        chrome_path: Chrome执行文件路径

    Returns:
        dict: 包含详细验证信息
    """
    validation_result = {
        "valid": False,
        "path": chrome_path,
        "checks": {},
        "suggestions": []
    }

    try:
        path = Path(chrome_path)

        # 检查1: 路径存在性
        exists = path.exists()
        validation_result["checks"]["exists"] = exists
        if not exists:
            validation_result["suggestions"].append("确认路径是否正确，注意大小写敏感")

        # 检查2: 是否为文件
        is_file = path.is_file() if exists else False
        validation_result["checks"]["is_file"] = is_file
        if exists and not is_file:
            validation_result["suggestions"].append("路径指向的是目录，需要指定具体的执行文件")

        # 检查3: 文件扩展名
        if is_file:
            suffix = path.suffix.lower()
            expected_suffix = '.exe' if importlib.util.find_spec('winreg') else ''
            extension_valid = suffix == expected_suffix or not suffix
            validation_result["checks"]["extension"] = extension_valid
            if not extension_valid:
                validation_result["suggestions"].append(f"文件扩展名应为{expected_suffix or '无'}")

        # 检查4: 文件大小
        if is_file:
            try:
                file_size = path.stat().st_size
                file_size_mb = file_size / (1024 * 1024)
                size_reasonable = file_size_mb > 10  # Chrome通常大于10MB
                validation_result["checks"]["file_size"] = {
                    "size_mb": round(file_size_mb, 2),
                    "reasonable": size_reasonable
                }
                if not size_reasonable:
                    validation_result["suggestions"].append("文件大小异常，可能不是有效的Chrome执行文件")
            except Exception as e:
                validation_result["checks"]["file_size"] = {"error": str(e)}

        # 检查5: 文件权限
        if is_file:
            try:
                # 尝试读取文件头判断是否为可执行文件
                with open(path, 'rb') as f:
                    header = f.read(4)
                    if header[:2] == b'MZ':  # Windows PE文件标识
                        validation_result["checks"]["executable_format"] = True
                    else:
                        validation_result["checks"]["executable_format"] = False
                        validation_result["suggestions"].append("文件格式不是标准的可执行文件")
            except Exception as e:
                validation_result["checks"]["executable_format"] = {"error": str(e)}

        # 综合判断
        all_checks_passed = all([
            validation_result["checks"].get("exists", False),
            validation_result["checks"].get("is_file", False),
            validation_result["checks"].get("extension", False),
            validation_result["checks"].get("file_size", {}).get("reasonable", False),
            validation_result["checks"].get("executable_format", False)
        ])

        validation_result["valid"] = all_checks_passed
        validation_result["message"] = "路径验证通过" if all_checks_passed else "路径验证失败"

        return validation_result

    except Exception as e:
        LOG.error("详细路径验证失败", error=str(e), chrome_path=chrome_path)
        validation_result["error"] = str(e)
        validation_result["message"] = f"验证过程中发生错误: {str(e)}"
        return validation_result
```

### 4.5 浏览器配置建议接口
```python
@router.get("/browser-config/suggestions")
async def get_browser_config_suggestions(
    api_key: str = Depends(validate_api_key)
) -> dict:
    """
    获取浏览器配置建议

    Returns:
        dict: 包含各种浏览器类型的配置建议
    """
    import platform

    system = platform.system()
    suggestions = {
        "system": system,
        "chrome_paths": {
            "Windows": [
                "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Users\\{username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"
            ],
            "Darwin": [  # macOS
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "/Applications/Chrome.app/Contents/MacOS/Google Chrome"
            ],
            "Linux": [
                "/usr/bin/google-chrome",
                "/usr/bin/google-chrome-stable",
                "/usr/bin/chromium",
                "/usr/bin/chromium-browser"
            ]
        },
        "common_args": [
            "--window-size=1920,1080",
            "--start-maximized",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage"
        ],
        "adspower_info": {
            "download_url": "https://www.adspower.com/download",
            "api_port": 50325,
            "requirements": [
                "AdsPower客户端已安装并运行",
                "API接口端口50325未被占用",
                "已创建至少一个浏览器配置"
            ]
        }
    }

    # 返回当前系统的建议路径
    current_paths = suggestions["chrome_paths"].get(system, [])
    suggestions["recommended_paths"] = current_paths

    return suggestions
```

### 4.6 路由注册
在主应用文件中注册新的路由：
```python
# 在 skyvern/forge/api_app.py 或相应的路由注册文件中
from skyvern.forge.sdk.routes.browser import router as browser_router

# 注册浏览器相关路由
app.include_router(browser_router, prefix="/api/v1/browser", tags=["browser"])
```

## 技术要点

1. **依赖注入**: 使用FastAPI的Depends进行API密钥验证
2. **错误处理**: 统一的异常处理和错误响应
3. **路径验证**: 多层次的文件系统检查
4. **平台兼容**: 支持Windows、macOS、Linux的路径格式
5. **详细验证**: 文件大小、格式、权限等全面检查

## API响应格式

### AdsPower状态响应
```json
{
  "available": true,
  "message": "AdsPower连接正常，找到 3 个浏览器",
  "browsers": [
    {
      "user_id": "user123",
      "name": "浏览器配置1",
      "serial_number": "SN123456",
      "remark": "备注信息",
      "group_id": "group1",
      "status": "Active"
    }
  ]
}
```

### Chrome路径验证响应
```json
{
  "valid": true,
  "message": "Chrome路径有效",
  "path": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "file_size_mb": 124.5
}
```

## 验证方法

1. **接口测试**: 使用curl或Postman测试各个端点
2. **错误场景**: 测试各种异常情况的处理
3. **权限验证**: 确认API密钥验证正常工作
4. **性能测试**: 验证AdsPower状态检查的性能
5. **跨平台**: 在不同操作系统上测试路径验证

## 下一步
完成API路由层开发后，进入步骤5：前端类型定义