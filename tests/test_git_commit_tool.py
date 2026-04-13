import os
import subprocess
import tempfile
import unittest

from git_commit_tool import (
    get_current_branch,
    get_git_commits,
    prompt_for_missing_project_names,
    save_commits_to_file,
)


class GitCommitToolTests(unittest.TestCase):
    def test_get_git_commits_preserves_multiline_message_body(self):
        original_cwd = os.getcwd()
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                self._init_repo_with_multiline_commit(temp_dir)

                commits, messages = get_git_commits(
                    repo_path=temp_dir,
                    start_date="2026-03-27",
                    end_date="2026-03-27",
                    author="GoldenZqqq",
                    pull_latest_code=False,
                    extract_all_branches=False,
                )

                self.assertEqual(len(commits), 1)
                self.assertEqual(len(messages), 1)

                _, message = messages[0]
                self.assertIn("fix: 扩展问卷题目选项上限到20项", message)
                self.assertIn("将单选题和多选题的选项渲染上限从 12 调整为 20", message)
                self.assertIn("抽出页面级选项上限配置，便于后续续封扩展", message)
            finally:
                os.chdir(original_cwd)

    def test_save_commits_to_file_flattens_multiline_messages(self):
        original_cwd = os.getcwd()
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                self._init_repo_with_multiline_commit(temp_dir)
                output_file = os.path.join(temp_dir, "git_commits.txt")

                output_text = save_commits_to_file(
                    commits=[],
                    messages=[
                        (
                            temp_dir,
                            "fix: 扩展问卷题目选项上限到20项\n\n- 将单选题和多选题的选项渲染上限从 12 调整为 20\n- 抽出页面级选项上限配置，便于后续续封扩展",
                        )
                    ],
                    output_file=output_file,
                    detailed_output=False,
                    project_names={},
                    show_project_and_branch=False,
                )

                self.assertIn(
                    "扩展问卷题目选项上限到20项；将单选题和多选题的选项渲染上限从 12 调整为 20；抽出页面级选项上限配置，便于后续续封扩展",
                    output_text,
                )
                self.assertNotIn("\n- 将单选题和多选题的选项渲染上限从 12 调整为 20", output_text)
            finally:
                os.chdir(original_cwd)

    def test_prompt_for_missing_project_names_updates_config_file(self):
        original_cwd = os.getcwd()
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                self._init_repo_with_multiline_commit(temp_dir)
                config_file = os.path.join(temp_dir, "config.yaml")
                config = {"project_names": {}}
                answers = iter(["y", "示例项目-"])

                prompt_for_missing_project_names(
                    messages=[(temp_dir, "fix: 新增命令行补齐项目映射")],
                    config=config,
                    config_file=config_file,
                    input_func=lambda _: next(answers),
                    print_func=lambda _: None,
                )

                current_branch = get_current_branch(temp_dir)
                expected_key = f"{os.path.basename(temp_dir)}({current_branch})"

                self.assertEqual(config["project_names"][expected_key], "示例项目-")

                with open(config_file, "r", encoding="utf-8") as file:
                    saved_text = file.read()

                self.assertIn(f"{expected_key}: 示例项目-", saved_text)
            finally:
                os.chdir(original_cwd)

    def _init_repo_with_multiline_commit(self, repo_path):
        self._run_git(repo_path, "init")
        self._run_git(repo_path, "config", "user.name", "GoldenZqqq")
        self._run_git(repo_path, "config", "user.email", "1361001127@qq.com")

        with open(os.path.join(repo_path, "note.txt"), "w", encoding="utf-8") as file:
            file.write("content\n")

        self._run_git(repo_path, "add", "note.txt")
        env = os.environ.copy()
        env["GIT_AUTHOR_DATE"] = "2026-03-27T11:50:54+08:00"
        env["GIT_COMMITTER_DATE"] = "2026-03-27T11:50:54+08:00"
        self._run_git(
            repo_path,
            "commit",
            "-m",
            "fix: 扩展问卷题目选项上限到20项",
            "-m",
            "- 将单选题和多选题的选项渲染上限从 12 调整为 20\n- 抽出页面级选项上限配置，便于后续续封扩展\n- 同步更新多选补充说明的未项判断逻辑",
            env=env,
        )

    def _run_git(self, repo_path, *args, env=None):
        subprocess.run(
            ["git", *args],
            cwd=repo_path,
            check=True,
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )


if __name__ == "__main__":
    unittest.main()
