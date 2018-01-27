FROM alpine

RUN apk update && apk add alpine-sdk automake wget

RUN ln -s /usr/include/locale.h /usr/include/xlocale.h

RUN wget http://www.live555.com/liveMedia/public/live555-latest.tar.gz && \
    tar -xzf live555-latest.tar.gz && \
    cd live && ./genMakefiles linux-64bit && \
    sed -i '/OutPacketBuffer::maxSize = 100000/c\  OutPacketBuffer::maxSize = 800000;' proxyServer/live555ProxyServer.cpp && \
    make && make install && \
    cd ../ && rm live555-latest.tar.gz && rm -rf live
