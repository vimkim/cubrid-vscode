# CUBRID Language for VS Code

**한국어** | [English](https://github.com/vimkim/cubrid-vscode/blob/main/README.en.md)

이 확장은 `.csql` 파일에 CUBRID 구문 색상, 들여쓰기, 자동 완성 및 구문 진단을 제공합니다. 자동 완성과 진단은 별도로 설치한 CUBRID 언어 서버가 처리합니다. SQL을 실행하거나 데이터베이스에 연결하지 않습니다.

## 알파 버전 설치

1. [v0.1.0-alpha.1 릴리스](https://github.com/vimkim/cubrid-vscode/releases/tag/v0.1.0-alpha.1)에서 [cubrid-language-0.1.0.vsix](https://github.com/vimkim/cubrid-vscode/releases/download/v0.1.0-alpha.1/cubrid-language-0.1.0.vsix)를 다운로드하세요.
2. 편집기에서 **Extensions: Install from VSIX** 명령을 실행하고 다운로드한 파일을 선택하세요.
3. Python 3.10 이상과 선택적 `lsp` 의존성을 포함한 공유 언어 서버를 설치하세요. [공유 엔진 설치 안내](https://github.com/vimkim/cubrid-language-tools/blob/main/docs/install.md)를 참고하세요.

이 확장은 VS Code 1.109.0 이상을 요구합니다. 다운로드할 알파 VSIX는 Linux의 OpenVSCode Server 1.109.5에서 테스트했습니다.

다운로드할 알파 파일은 변경되지 않았습니다. 현재 `main`에서 만든 빌드는 별도 산출물입니다. 검증한 확장과 서버 커밋은 [현재 소스와 검증 근거](https://github.com/vimkim/cubrid-vscode/blob/main/docs/acceptance.md#current-status-2026-10-30)를 참고하세요.

[2026-10-30 호스팅 실행](https://github.com/vimkim/cubrid-vscode/actions/runs/41010604044)은 Linux에서 패키지 작업과 Microsoft VS Code 데스크톱 1.109.0 및 stable 작업을 통과했습니다. [워크플로](https://github.com/vimkim/cubrid-vscode/blob/main/.github/workflows/ci.yml)는 이전 코어 `2a8842c`를 고정하며, 네이티브 런타임 없이 신뢰하는 작업 영역을 사용합니다. 이 실행은 Microsoft 데스크톱의 v4 네이티브 범위나 SHOW 및 힌트 작성 지원을 검증하지 않습니다. 현재 코어를 결합한 SHOW 및 힌트 검증은 OpenVSCode Server 1.109.5에서 수행했습니다.

서버, 네이티브 워커, 매니페스트와 런타임은 별도로 설치합니다. 확장과 Python wheel 모두 네이티브 자산을 포함하지 않습니다.

현재 v4 네이티브 범위를 사용하려면 현재 코어의 `lsp` extra와 일치하는 v4 워커 및 매니페스트를 설치하세요. [코어 설치 안내](https://github.com/vimkim/cubrid-language-tools/blob/main/docs/install.md)를 따르세요. 확장만 업데이트해도 서버와 네이티브 입력이 갱신되지는 않습니다. `cubrid-language-server --version`이 출력하는 `0.1.0.dev0`은 소스 커밋이나 지원 범위 개정을 식별하지 않습니다.

기본 서버 명령은 편집기 호스트의 PATH에 있는 `cubrid-language-server`입니다. 서버가 PATH에 없다면 사용자 또는 원격 컴퓨터 설정에서 `cubrid.serverPath`에 절대 경로를 지정하세요. 엄격한 구문 진단을 사용하려면 검증된 워커와 일치하는 런타임의 절대 경로를 `cubrid.parserWorker`와 `cubrid.runtimePrefix`에 함께 지정하세요. 아래 예시의 경로를 실제 설치 경로로 바꾸세요. 체크아웃의 `.venv`에 서버를 설치했다면 `.venv/bin/cubrid-language-server`의 절대 경로를 사용하세요.

```json
{
  "cubrid.serverPath": "/absolute/path/to/cubrid-language-server",
  "cubrid.parserWorker": "/absolute/path/to/parser-worker",
  "cubrid.runtimePrefix": "/absolute/path/to/cubrid/runtime"
}
```

매니페스트가 워커 옆의 `manifest.json`이 아니라면 신뢰하는 사용자 또는 원격 컴퓨터 설정의 `cubrid.workerManifest`에 절대 경로를 지정하세요.

키워드 자동 완성에는 네이티브 워커와 런타임이 필요하지 않습니다. 이 둘이 없으면 진단에 런타임 부재가 표시됩니다. 신뢰할 수 있는 설치의 경로를 사용하세요. 작업 영역 설정은 실행 파일을 선택할 수 없으며 신뢰하는 작업 영역에서만 서버를 시작합니다.

신뢰하는 작업 영역에서 서버 또는 `parser-worker` 실행 파일이 없거나 실행 권한이 없으면 [설치 가이드](https://github.com/vimkim/cubrid-language-tools/blob/main/docs/install.en.md)를 포함한 경고를 표시합니다. 네이티브 설정, 런타임 디렉터리, 매니페스트가 없어도 경고를 표시합니다. 네이티브 입력을 수정하기 전에는 엄격한 구문 진단을 사용할 수 없지만 키워드 자동 완성은 계속 사용할 수 있습니다. 자세한 내용은 **CUBRID** 출력 채널에서 확인하세요. 신뢰하는 사용자 또는 원격 컴퓨터 설정을 수정한 뒤 **CUBRID: Restart Language Server**를 실행하세요. 문서를 다시 열거나 스키마 설정을 바꿔도 같은 경고를 반복하지 않습니다. 확장은 구성 요소를 자동 설치하거나 브라우저를 자동 실행하지 않습니다.

`.sql`은 기본 SQL 언어로 유지됩니다. CUBRID로 열려면 사용자 설정에 `"files.associations": {"*.sql": "cubrid"}`를 추가하세요.

## 자동 완성과 구문 검사 범위

현재 공유 코어는 SHOW 및 힌트 자동 완성과 보수적인 작성 경고를 제공합니다. 제안이 나오거나 작성 경고가 없다고 해서 네이티브 구문 지원을 보증하지는 않습니다. 네이티브 SHOW 지원은 정확히 `SHOW TRACE`입니다. v4 힌트 확장은 제한된 리터럴 문법 안에서 최상위 리터럴 `SELECT` 바로 뒤에 오는 인자 없는 블록 `ORDERED` 하나만 허용합니다. 이 형식에 FROM, 조인 또는 다른 힌트를 허용하지 않습니다. 정확한 프로파일과 제한은 코어의 [검증된 지원 범위](https://github.com/vimkim/cubrid-language-tools/blob/main/docs/coverage.md)를 참고하세요.

포매팅과 의미 또는 스타일 린트는 향후 작업입니다.

## 개발용 빌드

소스 체크아웃에서 VSIX를 빌드하려면 다음 명령을 실행하세요.

```sh
npm ci
npm run package
```

## 스키마와 명령

`cubrid.schemaMode`는 `inherit`, `disabled`, `path` 중 하나입니다. `path`를 선택하면 `cubrid.schemaPath`에 절대 경로를 지정하세요. `CUBRID: Reload Schema`는 열린 문서별 상태를 표시합니다. 갱신에 실패하면 마지막 유효 메타데이터가 stale로 표시될 수 있습니다. `CUBRID: Restart Language Server`는 서버 시작 실패 후 다시 시도합니다. 초기화는 10초 후 시간 초과됩니다. 서버 경로를 수정하면 기존 프로세스가 종료된 뒤 새 서버를 시작합니다.

빈 진단 목록이 모든 SQL의 지원을 보증하지는 않습니다. 네이티브 런타임이 없으면 진단에 실패가 표시되지만 키워드 자동 완성은 계속 사용할 수 있습니다.
