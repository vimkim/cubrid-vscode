# CUBRID Language for VS Code

English instructions are in README.en.md.

이 확장은 `.csql` 파일에 CUBRID 구문 색상, 들여쓰기, 자동 완성 및 구문 진단을 제공합니다. 자동 완성과 진단은 별도로 설치한 CUBRID 언어 서버가 처리합니다. SQL을 실행하거나 데이터베이스에 연결하지 않습니다.

## 알파 버전 설치

1. [v0.1.0-alpha.1 릴리스](https://github.com/vimkim/cubrid-vscode/releases/tag/v0.1.0-alpha.1)에서 [cubrid-language-0.1.0.vsix](https://github.com/vimkim/cubrid-vscode/releases/download/v0.1.0-alpha.1/cubrid-language-0.1.0.vsix)를 다운로드하세요.
2. 편집기에서 **Extensions: Install from VSIX** 명령을 실행하고 다운로드한 파일을 선택하세요.
3. Python 3.10 이상과 선택적 `lsp` 의존성을 포함한 공유 언어 서버를 설치하세요. [공유 엔진 설치 안내](https://github.com/vimkim/cubrid-language-tools/blob/main/docs/install.md)를 참고하세요.

이 확장은 VS Code 1.109.0 이상을 요구합니다. Linux의 OpenVSCode Server 1.109.5에서 테스트했습니다. Microsoft VS Code 데스크톱은 아직 검증하지 않았습니다. 서버와 네이티브 런타임은 별도로 설치하며 확장에 포함되지 않습니다.

기본 서버 명령은 편집기 호스트의 PATH에 있는 `cubrid-language-server`입니다. 서버가 PATH에 없다면 사용자 또는 원격 컴퓨터 설정에서 `cubrid.serverPath`에 절대 경로를 지정하세요. 엄격한 구문 진단을 사용하려면 검증된 워커와 일치하는 런타임의 절대 경로를 `cubrid.parserWorker`와 `cubrid.runtimePrefix`에 함께 지정하세요. 아래 예시의 경로를 실제 설치 경로로 바꾸세요. 체크아웃의 `.venv`에 서버를 설치했다면 `.venv/bin/cubrid-language-server`의 절대 경로를 사용하세요.

```json
{
  "cubrid.serverPath": "/absolute/path/to/cubrid-language-server",
  "cubrid.parserWorker": "/absolute/path/to/parser-worker",
  "cubrid.runtimePrefix": "/absolute/path/to/cubrid/runtime"
}
```

키워드 자동 완성에는 네이티브 워커와 런타임이 필요하지 않습니다. 이 둘이 없으면 진단에 런타임 부재가 표시됩니다. 신뢰할 수 있는 설치의 경로를 사용하세요. 작업 영역 설정은 실행 파일을 선택할 수 없으며 신뢰하는 작업 영역에서만 서버를 시작합니다.

`.sql`은 기본 SQL 언어로 유지됩니다. CUBRID로 열려면 사용자 설정에 `"files.associations": {"*.sql": "cubrid"}`를 추가하세요.

## 개발용 빌드

소스 체크아웃에서 VSIX를 빌드하려면 다음 명령을 실행하세요.

```sh
npm ci
npm run package
```

## 스키마와 명령

`cubrid.schemaMode`는 `inherit`, `disabled`, `path` 중 하나입니다. `path`를 선택하면 `cubrid.schemaPath`에 절대 경로를 지정하세요. `CUBRID: Reload Schema`는 열린 문서별 상태를 표시합니다. 갱신에 실패하면 마지막 유효 메타데이터가 stale로 표시될 수 있습니다. `CUBRID: Restart Language Server`는 서버 시작 실패 후 다시 시도합니다. 초기화는 10초 후 시간 초과됩니다. 서버 경로를 수정하면 기존 프로세스가 종료된 뒤 새 서버를 시작합니다.

빈 진단 목록이 모든 SQL의 지원을 보증하지는 않습니다. 네이티브 런타임이 없으면 진단에 실패가 표시되지만 키워드 자동 완성은 계속 사용할 수 있습니다.
