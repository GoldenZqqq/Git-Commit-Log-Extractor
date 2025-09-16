'''
Description: 
Author: Huang Zhaoqi
LastEditors: Huang Zhaoqi
Date: 2024-10-14 16:43:27
LastEditTime: 2025-05-29 09:57:41
'''
from git_commit_tool import find_git_repos, get_git_commits, save_commits_to_file, load_config
import os
import datetime

if __name__ == "__main__":
    # 加载配置
    config = load_config()

    # 从配置文件中获取变量
    root_directory = config.get('root_directory', 'C:\\workspace')
    author = config.get('author', 'YourName')
    output_directory = config.get('output_directory', '~/Desktop')
    today = datetime.datetime.now().strftime('%Y-%m-%d') # 获取当前日期
    start_date = config.get("start_date", today) # 从配置获取开始日期，若未提供则使用今天的日期
    end_date = config.get("end_date", today) # 从配置获取结束日期，若未提供则使用今天的日期
    detailed_output = config.get('detailed_output', True)  # 是否输出详细日志
    project_names = config.get('project_names', {})  # 获取项目名称映射
    show_project_and_branch = config.get('show_project_and_branch', True)  # 获取控制输出的配置
    pull_latest_code = config.get('pull_latest_code', False)  # 是否在提取日志之前拉取最新代码
    extract_all_branches = config.get('extract_all_branches', False)  # 是否提取所有分支的提交记录

    # 确保start_date和end_date是有效的日期
    if not start_date:
        start_date = today
    if not end_date:
        end_date = today

    # 根据日期动态生成文件名
    if start_date == today and end_date == today:
        date_part = today  # 当天
    else:
        date_part = f"{start_date}_to_{end_date}"  # 日期范围

    # 查找所有 git 仓库
    git_repos = find_git_repos(root_directory)
    all_commits = []
    all_messages = []

    # 遍历每个仓库，获取提交记录
    for repo in git_repos:
        commits, messages = get_git_commits(repo, start_date, end_date, author, pull_latest_code, extract_all_branches)
        if commits:
            all_commits.extend(commits)
            all_messages.extend(messages)

    # 保存提交记录到指定文件夹
    output_file = os.path.join(os.path.expanduser(output_directory), f"git_commits_{date_part}.txt")
    
    if all_commits:
        output_text = save_commits_to_file(all_commits, all_messages, output_file, detailed_output, project_names, show_project_and_branch)
        if output_text:
            print(output_text)
    else:
        print(f"No commits found for {start_date} to {end_date}")