# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Python Backend Commands

- **Install dependencies**: `uv sync`
- **Run Skyvern service**: `skyvern run all` (starts both backend and UI)
- **Run backend only**: `skyvern run server`
- **Run UI only**: `skyvern run ui`
- **Check status**: `skyvern status`
- **Stop services**: `skyvern stop all`
- **Quickstart**: `skyvern quickstart` (for first-time setup with DB migrations)

### Code Quality & Testing

- **Lint**: `ruff check` and `ruff format`
- **Type checking**: `mypy skyvern`
- **Run tests**: `pytest tests/`
- **Pre-commit hooks**: `pre-commit run --all-files`

### Frontend Commands (in skyvern-frontend/)

- **Install dependencies**: `npm install`
- **Development**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Format**: `npm run format`

### Database Management

- **Run migrations**: `alembic upgrade head`
- **Create migration**: `alembic revision --autogenerate -m "description"`

## Architecture Overview

Skyvern is a browser automation platform that uses LLMs and computer vision to interact with websites. The architecture consists of:

### Core Components

- **Agent System** (`skyvern/agent/`): Multi-agent system for web navigation and task execution
- **Browser Engine** (`skyvern/webeye/`): Playwright-based browser automation with computer vision
- **Workflow Engine** (`skyvern/services/`): Orchestrates complex multi-step workflows
- **API Layer** (`skyvern/forge/`): FastAPI-based REST API and WebSocket support

### Key Directories

- `skyvern/agent/`: LLM-powered agents for web interaction
- `skyvern/webeye/`: Browser automation, DOM scraping, action execution
- `skyvern/forge/`: FastAPI server, API endpoints, request handling
- `skyvern/services/`: Business logic for tasks, workflows, and browser sessions
- `skyvern/cli/`: Command-line interface
- `skyvern/client/`: Generated Python client SDK
- `skyvern-frontend/`: React-based UI for task management and monitoring
- `alembic/`: Database migrations

### Workflow System

- **Blocks**: Modular components (navigation, extraction, validation, loops, etc.)
- **Parameters**: Dynamic values passed between blocks
- **Runs**: Execution instances of workflows
- **Browser Sessions**: Persistent browser state across workflow steps

### Data Flow

1. User creates tasks/workflows via UI or API
2. Agent system plans actions using LLM analysis of screenshots
3. Browser engine executes actions via Playwright
4. Results are captured, processed, and stored
5. Workflow orchestrator manages multi-step sequences

## Development Notes

### Environment Setup

- Requires Python 3.11+ and Node.js
- Uses UV for Python dependency management
- PostgreSQL database (managed via Docker or local install)
- Browser dependencies installed via Playwright

### LLM Configuration

Configure via environment variables or `skyvern init llm`:

- Supports OpenAI, Anthropic, Azure OpenAI, AWS Bedrock, Gemini, Ollama
- Uses `LLM_KEY` to specify which model to use
- `SECONDARY_LLM_KEY` for lightweight agent operations

### Testing Strategy

- Unit tests in `tests/unit_tests/`
- Integration tests require browser automation setup
- Use `pytest` with async support for testing

### Code Style

- Python: Ruff for linting and formatting (configured in pyproject.toml)
- TypeScript: ESLint + Prettier (configured in skyvern-frontend/)
- Line length: 120 characters
- Use type hints and async/await patterns

## Important Development Rules

### Port Conflict Resolution
When running Skyvern services, port conflicts are automatically handled:
- **UI Server (Port 8080)**: Uses `get_pids_on_port()` and `kill_pids()` functions in `skyvern/cli/run_commands.py` to detect and kill existing processes
- **API Server (Port 8000)**: Similar conflict resolution mechanism
- **Stop Command**: `skyvern stop all` terminates processes on ports 8000, 8080, and 9090
- **Cross-platform Support**: Uses `psutil` library for process management, supports Windows (`taskkill`) and Unix (`os.kill`)

### Browser Selection Frontend Implementation
The browser selection feature is implemented across multiple frontend components:
- **Main Component**: `skyvern-frontend/src/components/BrowserSelector.tsx` - Complete browser type selection with validation
- **Sidebar Integration**: `skyvern-frontend/src/components/BrowserConfigSidebar.tsx` - Collapsible sidebar with popover interface
- **Form Integration**: `skyvern-frontend/src/routes/tasks/create/TaskCreateWithSidebar.tsx` - Integrated into task creation workflow
- **Type Definitions**: `skyvern-frontend/src/api/browser-types.ts` - TypeScript interfaces for browser configurations
- **API Integration**: `skyvern-frontend/src/api/browser-api.ts` - Frontend API calls for browser validation and status checking

### Docker Volume Mounts Configuration
The `docker-compose.yml` file includes comprehensive volume mounting:
- **Data Directories**:
  - `./artifacts:/data/artifacts` - Task artifacts and screenshots
  - `./videos:/data/videos` - Browser recording videos
  - `./har:/data/har` - HTTP Archive files
  - `./log:/data/log` - Application logs
- **Configuration**:
  - `./.streamlit:/app/.streamlit` - Streamlit configuration
  - `./.env:/app/.env` - Environment variables (🔥 **Critical**: Overrides container config)
- **Development Mode**: Uncomment lines 37-38 to mount local code changes:
  - `./skyvern:/app/skyvern` - Backend code hot-reload
  - `./alembic:/app/alembic` - Database migrations