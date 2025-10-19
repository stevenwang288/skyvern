# 5. API路由扩展 (新建 skyvern/forge/sdk/routes/browser.py)
from fastapi import APIRouter, HTTPException, Depends
from pathlib import Path
from skyvern.forge.sdk.schemas.browser import AdsPowerStatus, BrowserConfig
from skyvern.webeye.adspower_service import AdsPowerService
from skyvern.forge.sdk.api.models import validate_api_key
import structlog

LOG = structlog.get_logger()

router = APIRouter()


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

        return {
            "valid": is_valid,
            "message": "Chrome路径有效" if is_valid else "Chrome路径无效或文件不存在",
            "path": str(path.absolute()) if is_valid else None
        }
    except Exception as e:
        return {
            "valid": False,
            "message": f"路径验证失败: {str(e)}",
            "path": None
        }