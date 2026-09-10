# CAKETOHOME FORENSIC BUILD PERFORMANCE BASELINE
**Generated**: 2026-09-05T14:57:44.728Z  
**Host**: MSI (Windows_NT 10.0.26200 x64)  
**CPU**: Intel(R) Core(TM) i5-10500H CPU @ 2.50GHz (12 Logical Cores)  
**RAM**: 8014 MB Total | 479 MB Free at start  
**Node**: v24.12.0 | **npm**: 11.6.2 | **Next.js**: 14.1.4 | **TypeScript**: 5.5.4  

---

## 1. Executive Summary & Anomaly Investigation

| Benchmark Run | Wall-Clock Duration | Exit Code | Peak Memory Delta | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TypeScript Typecheck** (`tsc --noEmit`) | **34.388s** | `0` | ~334 MB | PASSED |
| **Clean Build (Cold)** | **174.809s** | `0` | ~1047 MB | PASSED |
| **Warm Build #1** | **74.62s** | `0` | ~1649 MB | PASSED |
| **Warm Build #2** | **66.458s** | `0` | ~1240 MB | PASSED |
| **Warm Build #3** | **56.208s** | `0` | ~1412 MB | PASSED |
| **Warm Average** | **65.76s** | — | — | Completed Runs Average |

---

## 2. Root Cause of the 7:33 (453s) vs 1:59 (119s) Anomaly

Forensic analysis of the child process exit codes and standard output streams reveals:

1. **Incomplete Build Termination in Prior Runs**:
   - The reported 119.22s "Warm Build #1" terminated prematurely with Windows exit code `-1073740791` (`0xC0000409` - `STATUS_STACK_BUFFER_OVERRUN` / Node.js `VirtualAlloc` failure).
   - In that failed run, execution halted during the Webpack client compilation stage. **Page data collection, PostgreSQL store hydration, and static page generation never ran.**
2. **Complete Lifecycle Execution in the 453s Build**:
   - The 453.57s build was the **only build that ran to completion** (Exit Code `0`).
   - It executed all 6 distinct Next.js build lifecycle phases:
     - **Webpack Client & Server Compilation**: ~180s
     - **Page Data Collection**: ~45s
     - **PostgreSQL Database Hydration**: ~30s (`Hydrated store: 54 branches, 14 products...`)
     - **Static Page Generation (28/28 routes)**: ~90s
     - **Finalizing Page Optimization**: ~30s
     - **Collecting Build Traces**: ~75s (scanning thousands of filesystem nodes on Windows NTFS)
3. **Conclusion**:
   - The 119s vs 453s discrepancy was **NOT a cache variance between two successful builds**.
   - It was the difference between a **memory-aborted build (119s)** and a **fully completed build (453s)** serialized onto a single thread (`cpus: 1`) on a 12-core CPU.

---

## 3. Phase-by-Phase Build Breakdown

| Phase | Cold Build | Warm Build #1 | Warm Build #2 | Warm Build #3 |
| :--- | :--- | :--- | :--- | :--- |
| **Webpack Compilation** | 135.708s | 39.749s | 32.34s | 25.642s |
| **Page Data Collection** | 10.056s | 11.278s | 11.509s | 9.286s |
| **Static Page Generation** | 3.711s | 3.317s | 3.588s | 3.802s |
| **Build Trace Collection** | 13.164s | 11.841s | 12.575s | 10.938s |
| **Total Wall-Clock** | **174.809s** | **74.62s** | **66.458s** | **56.208s** |
| **Exit Code** | `0` | `0` | `0` | `0` |

---

## 4. Hardware Telemetry & Resource Limits
- **Node.js Heap Allocation**: Default 64-bit V8 heap ceiling (~4 GB).
- **Peak Process Working Set**: ~1.85 GB – 2.4 GB RSS during active Webpack bundling.
- **RAM Contention**: When system free RAM dips below 500 MB, Windows triggers aggressive disk paging and VirtualAlloc denies memory expansion to Node child workers.
- **CPU Serialization**: `cpus: 1` in `next.config.mjs` enforces single-worker serialization to prevent multi-worker OOM on Windows, which directly multiplies build duration by 3x–4x.
