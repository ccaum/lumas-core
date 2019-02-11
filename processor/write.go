package processor

import (
	. "github.com/3d0c/gmf"
)

func WriteFile(packets <-chan *Packet, outputCtx *FmtCtx) {
	if err := outputCtx.WriteHeader(); err != nil {
		fatal(err)
	}

  for packet := range packets {
    //Write the packet to a file
    if err := outputCtx.WritePacket(packet); err != nil {
      fatal(err)
    }
  }
}
