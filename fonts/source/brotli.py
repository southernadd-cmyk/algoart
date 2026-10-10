"""Small system-lib Brotli bridge for reproducible fontTools WOFF2 builds."""
import ctypes
MODE_FONT=2
enc=ctypes.CDLL('libbrotlienc.so.1');dec=ctypes.CDLL('libbrotlidec.so.1')
enc.BrotliEncoderMaxCompressedSize.argtypes=[ctypes.c_size_t]
enc.BrotliEncoderMaxCompressedSize.restype=ctypes.c_size_t
enc.BrotliEncoderCompress.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_size_t,ctypes.c_void_p,ctypes.POINTER(ctypes.c_size_t),ctypes.c_void_p]
dec.BrotliDecoderDecompress.argtypes=[ctypes.c_size_t,ctypes.c_void_p,ctypes.POINTER(ctypes.c_size_t),ctypes.c_void_p]
def compress(data,mode=0,quality=11,lgwin=22):
    size=ctypes.c_size_t(enc.BrotliEncoderMaxCompressedSize(len(data)))
    out=ctypes.create_string_buffer(size.value)
    if not enc.BrotliEncoderCompress(quality,lgwin,mode,len(data),data,ctypes.byref(size),out):raise ValueError('Brotli compression failed')
    return out.raw[:size.value]
def decompress(data):
    capacity=max(1024,len(data)*4)
    for _ in range(20):
        size=ctypes.c_size_t(capacity);out=ctypes.create_string_buffer(capacity)
        status=dec.BrotliDecoderDecompress(len(data),data,ctypes.byref(size),out)
        if status==1:return out.raw[:size.value]
        capacity*=2
    raise ValueError('Brotli decompression failed')
