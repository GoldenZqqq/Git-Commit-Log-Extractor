# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Git Commit Log Extractor - A Python-based GUI tool that automatically extracts and generates daily work reports from multiple Git repositories. It scans Git repos recursively, filters commits by author and date range, and produces formatted reports for standups and documentation.

## Key Commands

### Running the Application
```bash
# GUI Mode (recommended)
python gui.py

# Command Line Mode
python main.py
```

### Building Executable
```bash
# Build Windows executable with PyInstaller
python build.py
```

## Architecture

### Core Components

1. **git_commit_tool.py**: Core functionality module
   - `find_git_repos()`: Recursively discovers Git repositories
   - `get_git_commits()`: Extracts commits with filtering options
   - `save_commits_to_file()`: Formats and saves output
   - `load_config()`: Handles YAML configuration management with template-based approach

2. **gui.py**: Tkinter-based GUI application with Material UI styling
   - Calendar date pickers for date range selection
   - Configuration management interface
   - Real-time log extraction with progress feedback

3. **main.py**: Command-line interface that uses config.yaml for batch processing

4. **build.py**: PyInstaller packaging script that creates standalone executables

### Configuration System

Uses template-based configuration (config.template.yaml → config.yaml):
- Auto-creates personal config from template if missing
- Supports project name mapping with wildcard patterns
- Configuration options: root_directory, author, output_directory, date ranges, pull_latest_code, extract_all_branches

### Output Formats

- **Detailed**: Full commit info with hash, timestamp, author
- **Summary**: Concise commit messages with optional project/branch prefixes
- Supports project name mapping for cleaner output

## Dependencies

- pyyaml>=6.0: Configuration file handling
- pyinstaller>=5.0: Executable building
- pillow>=9.0: Image processing for GUI
- tkcalendar>=1.6.1: Calendar widget for date selection

## Important Notes

- No testing framework currently implemented
- Windows-focused with cross-platform support
- Uses subprocess for Git operations
- Supports both current branch and all-branches extraction
- Can optionally pull latest changes before extraction