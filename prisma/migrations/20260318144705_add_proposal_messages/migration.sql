-- CreateTable
CREATE TABLE "ProposalMessage" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "senderBusinessId" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalMessage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProposalMessage" ADD CONSTRAINT "ProposalMessage_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalMessage" ADD CONSTRAINT "ProposalMessage_senderBusinessId_fkey" FOREIGN KEY ("senderBusinessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
