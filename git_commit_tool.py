import os
import datetime
import subprocess
import yaml  # 用来读取 YAML 配置文件
import re
import shutil

def load_config(config_file="config.yaml"):
    """
    从配置文件中加载配置项。如果配置文件不存在，则从模板创建。
    
    :param config_file: 配置文件路径
    :return: 配置项的字典
    """
    # 如果配置文件不存在，尝试从模板创建
    if not os.path.exists(config_file):
        template_file = "config.template.yaml"
        if os.path.exists(template_file):
            print(f"⚠️ 配置文件 {config_file} 不存在")
            print(f"📋 正在从模板 {template_file} 创建配置文件...")
            
            try:
                shutil.copy2(template_file, config_file)
                print(f"✅ 已创建配置文件: {config_file}")
                print(f"💡 请编辑 {config_file} 文件设置你的个人配置")
            except Exception as e:
                print(f"❌ 创建配置文件失败: {e}")
                print(f"💡 请手动复制 {template_file} 为 {config_file}")
        else:
            print(f"❌ 配置文件 {config_file} 和模板文件 {template_file} 都不存在")
            print("💡 请创建配置文件或检查文件路径")
            # 返回默认配置
            return {
                'root_directory': '',
                'author': '',
                'output_directory': '',
                'start_date': '',
                'end_date': '',
                'detailed_output': True,
                'show_project_and_branch': True,
                'pull_latest_code': False,
                'extract_all_branches': False,
                'project_names': {}
            }
    
    try:
        with open(config_file, 'r', encoding='utf-8') as file:
            return yaml.safe_load(file)
    except Exception as e:
        print(f"❌ 读取配置文件失败: {e}")
        return {}


def find_git_repos(root_dir, max_depth=None):
    """
    递归查找 root_dir 下的所有 git 仓库。
    :param root_dir: 搜索的根目录
    :param max_depth: 最大递归深度，如果为 None 则不限制
    :return: 包含所有 Git 仓库路径的列表
    """
    git_repos = []

    for root, dirs, files in os.walk(root_dir):
        if max_depth is not None:
            current_depth = len(os.path.relpath(root, root_dir).split(os.sep))
            if current_depth > max_depth:
                dirs[:] = []  # 防止进一步递归
                continue

        if '.git' in dirs:  # 如果找到 .git 目录，认为是 Git 仓库
            git_repos.append(root)
            dirs[:] = []  # 防止递归进入子目录

    return git_repos
        
def get_current_branch(repo_path):
    """获取当前Git分支名称"""
    try:
        os.chdir(repo_path)  # 切换到指定的仓库路径
        return subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).strip().decode('utf-8')
    except subprocess.CalledProcessError:
        return "unknown branch"


def get_git_commits(repo_path, start_date, end_date, author, pull_latest_code, extract_all_branches):
    """
    获取指定日期、作者的 git 提交记录，并在获取之前拉取最新代码。

    :param repo_path: 仓库路径
    :param date_str: 日期字符串，格式为 'YYYY-MM-DD'
    :param author: 作者名
    :param pull_latest_code: 是否拉取最新代码
    :param extract_all_branches: 是否提取所有分支的提交记录
    :return: 提交记录和提交信息列表
    """
    try:
        os.chdir(repo_path)

        # 根据配置决定是否拉取最新代码
        if pull_latest_code:
            pull_command = ['git', 'pull']
            subprocess.run(pull_command, check=True)

        commits = []
        messages = []

        if extract_all_branches:
            # 获取所有分支的提交记录
            git_log_command = [
                'git', 'log',
                '--all',
                '--since="{} 00:00:00"'.format(start_date),
                '--until="{} 23:59:59"'.format(end_date),
                '--author={}'.format(author),
                '--pretty=format:Hash: %H%nAuthor: %an%nDate: %ad%nMessage: %B%n',
                '--date=iso'
            ]
        else:
            # 获取当前分支的提交记录
            git_log_command = [
                'git', 'log',
                '--since="{} 00:00:00"'.format(start_date),
                '--until="{} 23:59:59"'.format(end_date),
                '--author={}'.format(author),
                '--pretty=format:Hash: %H%nAuthor: %an%nDate: %ad%nMessage: %B%n',
                '--date=iso'
            ]


        result = subprocess.run(git_log_command, capture_output=True, text=True, check=True, encoding='utf-8')

        if result.stdout:
            for commit in result.stdout.strip().split('\n\n'):
                if commit:
                    cleaned_commit = f"Repository: {repo_path}\n{commit.strip()}"
                    commits.append(cleaned_commit)

                    message_start = commit.find('Message:')
                    if message_start != -1:
                        message = commit[message_start + len('Message:'):].strip()
                        messages.append((repo_path, message))

        return commits, messages
    
    except subprocess.CalledProcessError as e:
        print(f"Error in {repo_path}: {e}")
        return [], []


def clean_commit_message(message):
    """
    去掉 'feat: ', 'fix: ' 等前缀，并处理任何特殊符号。
    
    :param message: 原始提交信息
    :return: 处理后的提交信息
    """
    cleaned_message = re.sub(r'^(feat|fix|refactor|chore|docs|style|test|perf|ci|build|revert|init):\s*', '', message, flags=re.IGNORECASE)
    cleaned_message = cleaned_message.replace("['']", "").replace('"', '')
    return cleaned_message


def save_commits_to_file(commits, messages, output_file, detailed_output, project_names, show_project_and_branch):
    """
    将所有仓库的 commit 记录保存到指定文件，并在文件末尾汇总所有的提交 message。
    
    :param commits: commit 记录列表。
    :param messages: 所有 commit 的 message 列表（包含 repo 路径信息）。
    :param output_file: 输出文件路径。
    :param detailed_output: 布尔值，控制是否输出详细记录。
    :param project_names: 项目名称映射字典。
    :param show_project_and_branch: 布尔值，控制是否显示项目名与分支名。
    """
    try:
        output_file = os.path.abspath(output_file)

        # 先构建完整文本内容，便于同时写入文件与回显到终端
        output_text_parts = []

        if detailed_output:
            for commit in commits:
                output_text_parts.append(commit + '\n\n')
                output_text_parts.append('\n' + '='*40 + '\n')
                output_text_parts.append('Summary of all commit messages:\n\n')

        for entry in messages:
            if isinstance(entry, tuple) and len(entry) == 2:
                repo_path, message = entry
                project_name = os.path.basename(repo_path)
                cleaned_message = clean_commit_message(message)
                current_branch = get_current_branch(repo_path)

                # 首先检查是否有精确匹配的项目名+分支名
                custom_project_name = project_names.get(f"{project_name}({current_branch})", "")

                # 如果没有精确匹配，检查是否有通配符匹配
                if not custom_project_name:
                    wildcard_key = f"{project_name}(*)"
                    custom_project_name = project_names.get(wildcard_key, "")

                # 生成输出内容
                if show_project_and_branch:
                    output_line = f"{project_name}({current_branch}) - {custom_project_name}{cleaned_message}\n"
                else:
                    output_line = f"{custom_project_name}{cleaned_message}\n"

                output_text_parts.append(output_line)

        output_text = ''.join(output_text_parts)

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(output_text)

        print(f"File successfully saved at: {output_file}")
        return output_text
    except Exception as e:
        print(f"Failed to save file: {e}")
        return ""
