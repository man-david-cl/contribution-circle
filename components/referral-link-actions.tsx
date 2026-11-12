'use client';

import {useState} from 'react';

export function ReferralLinkActions({url}:{url:string}){
  const [copied,setCopied]=useState(false);
  async function copy(){
    try{
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(()=>setCopied(false),2000);
    }catch{
      setCopied(false);
    }
  }
  const message=encodeURIComponent(`Join my Contribution Circle using my referral link: ${url}`);
  return <div className="referral-actions">
    <button type="button" className="btn btn-primary" onClick={copy}>{copied?'Copied!':'Copy referral link'}</button>
    <a className="btn btn-secondary" href={`https://wa.me/?text=${message}`} target="_blank" rel="noreferrer">Share on WhatsApp ↗</a>
  </div>;
}
