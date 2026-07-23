# Portable x86-64 CPU baseline for release builds (Windows CI).
#
# Почему это нужно: whisper-rs-sys собирает whisper.cpp/ggml с дефолтом
# GGML_NATIVE=ON. Под MSVC это включает cmake/FindSIMD.cmake, который детектит
# инструкции ПРОЦЕССОРА CI-РАННЕРА и, если раннеру достался Intel с AVX-512,
# компилирует весь ggml с /arch:AVX512. Такой бинарь мгновенно падает с
# 0xc000001d (STATUS_ILLEGAL_INSTRUCTION) на клиентских CPU без AVX-512
# (например Intel Core 10-го поколения и большинство consumer-ноутбуков).
# Парк раннеров GitHub смешанный, поэтому баг воспроизводился лотереей от
# релиза к релизу.
#
# GGML_NATIVE=OFF переводит ggml на явные флаги: AVX/AVX2/FMA включены
# (портабельный базлайн /arch:AVX2, CPU 2013+), AVX-512 выключен.
#
# Файл подключается через env CMAKE_TOOLCHAIN_FILE в build.yml (Windows-шаги).
# CMake >= 3.21 читает эту переменную сам; build.rs whisper-rs-sys дополнительно
# пробрасывает её как -D define. llama-cpp-sys-2 (llama-helper) не подвержен
# багу — он сам ставит GGML_NATIVE=OFF — но toolchain-файл ему не мешает.

set(GGML_NATIVE OFF CACHE BOOL "portable release build: no runner-native SIMD" FORCE)

set(GGML_AVX  ON  CACHE BOOL "" FORCE)
set(GGML_AVX2 ON  CACHE BOOL "" FORCE)
set(GGML_FMA  ON  CACHE BOOL "" FORCE)

set(GGML_AVX512      OFF CACHE BOOL "" FORCE)
set(GGML_AVX512_VBMI OFF CACHE BOOL "" FORCE)
set(GGML_AVX512_VNNI OFF CACHE BOOL "" FORCE)
set(GGML_AVX512_BF16 OFF CACHE BOOL "" FORCE)
