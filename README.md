# CUBRID Language for VS Code

English instructions are in README.en.md.

이 확장은 `.csql` 파일에 CUBRID 구문 색상, 들여쓰기, 자동 완성 및 구문 진단을 제공합니다. 자동 완성과 진단은 별도로 설치한 CUBRID 언어 서버가 처리합니다. SQL을 실행하거나 데이터베이스에 연결하지 않습니다.

## 설치

Python 3.10 이상과 CUBRID 언어 서버의 LSP 의존성을 설치하세요. 서버 설치 방법은 언어 도구 저장소의 `docs/lsp.md`를 참조하세요. 이 저장소에서 다음 명령으로 VSIX를 만듭니다.

```sh
npm ci
npm run package
```

VS Code의 **Extensions: Install from VSIX** 명령으로 생성된 VSIX를 설치하세요. 테스트한 편집기는 OpenVSCode Server 1.109.5입니다. Microsoft VS Code 데스크톱은 아직 검증하지 않았습니다.

서버가 PATH에 없으면 사용자 또는 원격 컴퓨터 설정에서 `cubrid.serverPath`를 절대 경로로 지정하세요. 네이티브 구문 진단을 사용하려면 `cubrid.parserWorker`와 `cubrid.runtimePrefix`를 함께 절대 경로로 지정하세요. 이 경로는 신뢰할 수 있는 설치에서 가져와야 합니다. 작업 영역 설정은 실행 파일을 선택할 수 없습니다. 신뢰하지 않는 작업 영역에서는 서버를 시작하지 않습니다.

`.sql`은 기본 SQL 언어로 유지됩니다. CUBRID로 열려면 사용자 설정에 `"files.associations": {"*.sql": "cubrid"}`를 추가하세요.

## 스키마와 명령

`cubrid.schemaMode`는 `inherit`, `disabled`, `path` 중 하나입니다. `path`를 선택하면 `cubrid.schemaPath`에 절대 경로를 지정하세요. `CUBRID: Reload Schema`는 열린 문서별 상태를 표시합니다. 갱신에 실패하면 마지막 유효 메타데이터가 stale로 표시될 수 있습니다. `CUBRID: Restart Language Server`는 서버 시작 실패 후 다시 시도합니다.

빈 진단 목록이 모든 SQL의 지원을 보증하지는 않습니다. 네이티브 런타임이 없으면 진단에 실패가 표시되지만 키워드 자동 완성은 계속 사용할 수 있습니다.
