from pathlib import Path


def test_windows_native_install_path_docs_match_installer() -> None:
    doc = Path("website/docs/user-guide/windows-native.md").read_text()
    install = Path("scripts/install.ps1").read_text()

    assert "%LOCALAPPDATA%\\nimro\\nimro-agent\\venv\\Scripts" in doc
    assert "Get-Command nimro        # should print C:\\Users\\<you>\\AppData\\Local\\nimro\\nimro-agent\\venv\\Scripts\\nimro.exe" in doc
    assert '$nimroBin = "$InstallDir\\venv\\Scripts"' in install
